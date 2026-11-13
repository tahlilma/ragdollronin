#!/usr/bin/env node
'use strict';
/*
 * One command for Ragdoll Ronin on your network:
 *   - serves the game with `npx serve` (port 3000)
 *   - starts the LAN duel relay from server.js (port 8787)
 *
 *   npm start                 (or: node start.js)
 *   set GAME_PORT=4000 && npm start
 *   node start.js --no-open   (don't open a browser)
 */
const { spawn, exec } = require('child_process');
const http = require('http');
const os = require('os');

const GAME_PORT = Number(process.env.GAME_PORT) || 3000;

require('./server.js'); // the duel relay

const serve = spawn(`npx --yes serve -l ${GAME_PORT} --no-clipboard`, { cwd: __dirname, stdio: 'inherit', shell: true });
serve.on('exit', (code) => { console.log(`serve stopped (${code}).`); process.exit(code || 0); });
const stop = () => { try { serve.kill(); } catch (e) { /* already gone */ } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// once the game is reachable, print where to open it and launch a browser
const t0 = Date.now();
(function poll() {
  http.get({ host: '127.0.0.1', port: GAME_PORT, path: '/' }, (res) => {
    res.resume();
    const lan = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if ((a.family === 'IPv4' || a.family === 4) && !a.internal) lan.push(a.address);
    }
    console.log('');
    console.log('  RAGDOLL RONIN is ready');
    console.log(`  Play on this computer:   http://localhost:${GAME_PORT}`);
    for (const a of lan) console.log(`  Friends on your network: http://${a}:${GAME_PORT}`);
    console.log('  Everyone types a name and presses "Join duel" to fight each other.');
    console.log('  (If Windows asks about the firewall, allow Node.js on private networks.)');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
    if (!process.argv.includes('--no-open')) {
      const url = `http://localhost:${GAME_PORT}`;
      exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`, () => {});
    }
  }).on('error', () => { if (Date.now() - t0 < 180000) setTimeout(poll, 500); });
})();
