#!/usr/bin/env node
'use strict';
/*
 * Ragdoll Ronin - local / LAN duel relay (the online version runs on Cloudflare: see relay/).
 * The game is served by `npx serve` (see start.js / `npm start`); this relay carries PvP messages
 * over WebSocket on port 8787, with the same room logic as the online relay (relay/room.mjs).
 * No npm packages needed.
 *
 *   npm start                   -> npx serve on :3000 + this relay on :8787
 *   node server.js              -> relay only (it can also serve the game itself: http://localhost:8787)
 *   set PORT=9000 && node server.js
 *
 * Every player's browser simulates its own samurai; this relay just passes snapshots, hits and
 * parries between them, and keeps score.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8787;
const ROOT = __dirname;
const MAX_MSG = 64 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};

const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(a.address);
  }
  return out;
}

// ------------------------------------------------------------------ static files
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { res.writeHead(400); res.end(); return; }
  if (pathname === '/lan') { // read by the title screen, which is served from a different port (npx serve)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ port: PORT, addresses: lanAddresses(), players: totalPlayers() }));
    return;
  }
  if (pathname === '/status') {
    const r = rooms.get(roomName ? roomName(new URL(req.url, 'http://localhost').searchParams.get('room')) : 'public');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ room: r ? r.name : 'public', players: r ? r.size : 0 }));
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.join(ROOT, pathname);
  const rel = path.relative(ROOT, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).some((s) => s.startsWith('.'))) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

// ------------------------------------------------------------------ minimal WebSocket (RFC 6455)
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
class WsConn {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.frags = []; this.closed = false;
    this.onmessage = () => {}; this.onclose = () => {};
    socket.on('data', (d) => this.data(d));
    socket.on('close', () => this.finish());
    socket.on('end', () => this.finish());
    socket.on('error', () => this.finish());
  }
  data(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 2 && !this.closed) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MSG)) { this.close(1009); return; }
        len = Number(big); off = 10;
      }
      if (len > MAX_MSG || !masked) { this.close(1002); return; } // clients must mask
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { this.frame(0xa, payload); continue; }
      if (op === 0xa) continue;
      if (op === 0x0 || op === 0x1 || op === 0x2) {
        this.frags.push(payload);
        if (this.frags.reduce((a, b) => a + b.length, 0) > MAX_MSG) { this.close(1009); return; }
        if (fin) {
          const msg = Buffer.concat(this.frags).toString('utf8');
          this.frags = [];
          try { this.onmessage(msg); } catch (e) { log('message error:', e.message); }
        }
      }
    }
  }
  frame(op, payload) {
    if (this.closed) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([head, payload])); } catch (e) { this.finish(); }
  }
  send(str) { this.frame(0x1, Buffer.from(str, 'utf8')); }
  close(code = 1000) {
    if (this.closed) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(code, 0);
    this.frame(0x8, p);
    try { this.socket.end(); } catch (e) { /* gone */ }
    this.finish();
  }
  finish() { if (this.closed) return; this.closed = true; this.onclose(); }
}

// ------------------------------------------------------------------ duel rooms (shared with the Cloudflare relay)
const rooms = new Map();
let DuelRoom = null, roomName = null;
const totalPlayers = () => [...rooms.values()].reduce((a, r) => a + r.size, 0);

server.on('upgrade', (req, socket) => {
  let url = null;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { /* bad url */ }
  const key = req.headers['sec-websocket-key'];
  if (!url || url.pathname !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !DuelRoom) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Accept: ' + accept, '', ''].join('\r\n'));
  socket.setNoDelay(true);
  const name = roomName(url.searchParams.get('room'));
  let room = rooms.get(name);
  if (!room) { room = new DuelRoom(name, log); rooms.set(name, room); }
  const conn = new WsConn(socket);
  const p = room.connect(conn);
  conn.onmessage = (raw) => room.message(p, raw);
  conn.onclose = () => { room.leave(p); if (!room.size) rooms.delete(name); };
});

// ------------------------------------------------------------------ start
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use - is a duel relay already running? Only one is needed per network.`);
  else console.error(e);
  process.exit(1);
});
import('./relay/room.mjs').then((mod) => {
  DuelRoom = mod.DuelRoom; roomName = mod.roomName;
}).catch((e) => { console.error('Could not load relay/room.mjs:', e); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  log(`Duel relay listening on port ${PORT} (ws://localhost:${PORT}/ws)`);
  if (require.main === module) {
    console.log(`  Tip: "npm start" serves the game with npx serve and starts this relay together.`);
    console.log(`  This relay can also serve the game directly: http://localhost:${PORT}`);
  }
  if (process.argv.includes('--open')) {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    require('child_process').exec(cmd, () => {});
  }
});
