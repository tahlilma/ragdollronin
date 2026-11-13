'use strict';
// Online duel client.
//  - Relay: the Cloudflare relay set in js/config.js (written by `npm run deploy:relay`), or the local
//    relay (server.js, port 8787) when none is configured. Override with ?relay=host:port or a full URL.
//  - Rooms: ?room=code or the room box on the title screen (default "public").
//  - Every client simulates its own samurai and streams timestamped snapshots (~30/s while moving,
//    ~8/s when still). Rivals play back through an adaptive jitter buffer keyed to the sender's clock,
//    so the delay is just one send interval + measured jitter, and they extrapolate briefly if a
//    packet is late.
//  - Hits are attacker-judged: you hit what you see (with instant local feedback); the victim's client
//    applies the damage (dash i-frames and invulnerability still protect them).
const RELAY_PORT = 8787;
const TAUNTS_PVP = ['Is that all?', 'Bonk.', 'Get noodled.', 'Skill issue.', 'Honor? Never heard of it.', 'HIYAAA!', 'Come here!', 'GG', 'Nice try.', 'Again!'];

const _pstyle = new Map();
function playerStyle(color) {
  if (!color) return STYLES.player;
  let s = _pstyle.get(color);
  if (!s) { s = Object.assign({}, STYLES.player, { band: color, obi: color }); _pstyle.set(color, s); }
  return s;
}

class Remote {
  constructor(id) {
    this.id = id; this.snaps = []; this.pose = newPose(); this.ready = false;
    this.x = 0; this.y = 0; this.f = 1; this.hp = 5; this.fl = 0; this.ang = 0; this.av = 0;
    this.hx = 0; this.hy = 0; this.bx = 0; this.by = 0; this.tx = 0; this.ty = 0;
    this.band1 = new Rope(7, 4.5, 0, 0); this.band2 = new Rope(6, 4.2, 0, 0);
    this.trail = []; this.hitCD = 0; this.clashCD = 0;
    this.offs = []; this.offset = null; this.jits = []; this.jitter = 8; this.gap = 33;
  }
  get dead() { return !!(this.fl & 2); }
  hurtbox() { return { x: this.x - 9, y: this.y - 24, w: 18, h: 50 }; }
  vulnerable() { return this.ready && !(this.fl & (1 | 2 | 4 | 32)); }
  bladeLive() { return this.ready && !(this.fl & (1 | 2)); }
  push(m) {
    const now = performance.now();
    if (typeof m.ts !== 'number') m.ts = now; // old clients: fall back to arrival time
    // clock offset = smallest (arrival - send) seen recently = clock difference + best-case latency
    const off = now - m.ts;
    this.offs.push(off);
    if (this.offs.length > 90) this.offs.shift();
    this.offset = Math.min(...this.offs);
    // jitter = 90th percentile of how late packets arrive vs the best case (robust to one-off spikes)
    this.jits.push(off - this.offset);
    if (this.jits.length > 60) this.jits.shift();
    const sorted = this.jits.slice().sort((a, b) => a - b);
    this.jitter = sorted[Math.floor(sorted.length * 0.9)] || 0;
    const last = this.snaps[this.snaps.length - 1];
    if (last) {
      if (m.ts <= last.ts) return; // stale / duplicate
      this.gap = lerp(this.gap, Math.min(m.ts - last.ts, 150), 0.2);
    }
    this.snaps.push(m);
    if (this.snaps.length > 60) this.snaps.shift();
  }
  update(now, dt) {
    this.hitCD -= dt; this.clashCD -= dt;
    const S = this.snaps;
    if (!S.length) return;
    // play back one send interval + jitter behind the sender (in the sender's clock)
    const delay = clamp(Math.min(this.gap, 40) + Math.min(this.jitter, 50) + 4, 15, 100);
    const rt = now - this.offset - delay;
    while (S.length > 2 && S[1].ts <= rt) S.shift();
    const a = S[0], b = S[1] || S[0];
    let x, y, ang, k = 0, ex = 0;
    if (b !== a && rt <= b.ts) {
      k = clamp((rt - a.ts) / (b.ts - a.ts), 0, 1);
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 250) k = 1; // respawn teleport: don't smear
      x = lerp(a.x, b.x, k); y = lerp(a.y, b.y, k);
      ang = a.a + angDiff(a.a, b.a) * k;
    } else {
      // packet late: extrapolate from the newest snapshot for up to 90 ms
      const s = S[S.length - 1];
      ex = clamp(rt - s.ts, 0, 90) / 1000;
      const moving = !(s.fl & (1 | 2));
      x = s.x + (moving ? (s.vx || 0) * ex : 0); y = s.y + (moving ? (s.vy || 0) * ex : 0);
      ang = s.a + (moving ? clamp(s.av * ex, -1, 1) : 0);
    }
    const src = ex ? S[S.length - 1] : b;
    const from = ex ? src : a;
    this.f = src.f; this.hp = src.hp; this.fl = src.fl; this.av = src.av;
    const dx = ex ? x - src.x : 0, dy = ex ? y - src.y : 0;
    for (let i = 0; i < JOINTS.length; i++) {
      const q = this.pose[JOINTS[i]];
      q.x = lerp(from.j[2 * i], src.j[2 * i], ex ? 1 : k) + dx;
      q.y = lerp(from.j[2 * i + 1], src.j[2 * i + 1], ex ? 1 : k) + dy;
    }
    this.x = x; this.y = y; this.ang = ang;
    const c = Math.cos(ang), s = Math.sin(ang);
    this.hx = this.pose.hF.x; this.hy = this.pose.hF.y;
    this.bx = this.hx + c * 10; this.by = this.hy + s * 10;
    this.tx = this.hx + c * 80; this.ty = this.hy + s * 80;
    this.trail.push({ bx: this.bx, by: this.by, tx: this.tx, ty: this.ty, t: now, s: Math.abs(this.av) });
    while (this.trail.length && now - this.trail[0].t > 85) this.trail.shift();
    if (!this.ready) { this.band1.reset(this.pose.head.x, this.pose.head.y); this.band2.reset(this.pose.head.x, this.pose.head.y); }
    const h = this.pose.head, f = this.fl & 1 ? 1 : this.f;
    this.band1.update(h.x - f * 6, h.y - 3, 0); this.band2.update(h.x - f * 6, h.y - 1, 0);
    this.ready = true;
  }
  draw(ctx) {
    if (!this.ready) return;
    const info = Net.roster.get(this.id), color = info ? info.color : '#ffffff', st = playerStyle(color);
    const p = this.pose, rag = this.fl & 1;
    ctx.globalAlpha = (this.fl & 32) && Math.floor(G.time * 18) % 2 === 0 ? 0.45 : 1;
    this.band2.draw(ctx, shade(st.band, -0.2), 2.4);
    this.band1.draw(ctx, st.band, 2.8);
    drawFigure(ctx, p, st, rag ? sgn(p.head.x - p.hip.x) : this.f, false);
    drawSlashTrail(ctx, this.trail);
    drawKatana(ctx, this.hx, this.hy, this.ang, 80, 1, st, Math.abs(this.av) > 26 ? '#bff6ff' : null);
    ctx.globalAlpha = 1;
    if (this.fl & 64) drawStars(ctx, p.head.x, p.head.y - 14, G.time);
    if (this.fl & 2) return;
    const ny = Math.min(p.head.y, p.hip.y) - 30;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 12px "Zen Kaku Gothic New", system-ui, sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const name = info ? info.name : '???';
    ctx.strokeText(name, p.head.x, ny); ctx.fillStyle = color; ctx.fillText(name, p.head.x, ny);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < this.hp ? '#e5323d' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.head.x - 14 + i * 6, ny + 9, 4, 3);
    }
  }
}

const Net = {
  ws: null, id: 0, connected: false, remotes: new Map(), roster: new Map(),
  map: 0, target: 10, over: null, feed: [], sendT: 0, name: '', color: '#e5323d', room: 'public',
  ping: 0, pings: [], pingTimer: null, lastSent: null, onWelcome: null, onFail: null,

  // the configured online relay (Cloudflare), if any
  onlineRelay() {
    const q = new URLSearchParams(location.search).get('relay');
    if (q) return q;
    const c = window.RR_CONFIG && window.RR_CONFIG.relay;
    return c || '';
  },
  isOnline() { return !!this.onlineRelay(); },
  available() { return this.isOnline() || location.protocol === 'http:' || location.protocol === 'https:'; },
  // ws(s)://host[:port] of the relay, without a path
  relayBase() {
    let r = this.onlineRelay();
    if (!r) r = `ws://${location.hostname || 'localhost'}:${RELAY_PORT}`;
    if (!/^wss?:\/\//.test(r)) r = r.replace(/^https?:\/\//, '');
    if (!/^wss?:\/\//.test(r)) r = (location.protocol === 'https:' ? 'wss://' : 'ws://') + r;
    return r.replace(/\/+$/, '');
  },
  relayHttp() { return this.relayBase().replace(/^ws/, 'http'); },
  // kept for older callers (LAN hint)
  relayHost() { return this.relayBase().replace(/^wss?:\/\//, ''); },

  connect(name, room, onWelcome, onFail) {
    this.disconnect();
    this.name = name; this.room = room || 'public'; this.onWelcome = onWelcome; this.onFail = onFail;
    let ws;
    try { ws = new WebSocket(`${this.relayBase()}/ws?room=${encodeURIComponent(this.room)}`); }
    catch (e) { onFail('Could not open a connection to the duel server.'); return; }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', name, v: 2 }));
      // ping from a timer (not the frame loop) so it measures the network, not frame timing
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.sendPing(), 1000);
    };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m && m.t) this.onMsg(m); };
    ws.onerror = () => {};
    ws.onclose = () => {
      const was = this.connected;
      this.ws = null; this.reset();
      if (was) G.onNetLost();
      else if (this.onFail) this.onFail(this.isOnline()
        ? 'Could not reach the online duel server. Try again in a moment.'
        : `Could not reach the duel relay at ${this.relayHost()}. Start it with "npm start".`);
    };
  },
  disconnect() {
    const ws = this.ws;
    this.ws = null; this.reset();
    if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { /* already closed */ } }
  },
  reset() {
    clearInterval(this.pingTimer); this.pingTimer = null;
    this.connected = false; this.id = 0; this.remotes.clear(); this.roster.clear(); this.over = null; this.feed = []; this.lastSent = null;
    this.ping = 0; this.pings = [];
  },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  sendPing() { this.send({ t: 'ping', c: performance.now() }); },
  setRoster(list) {
    this.roster.clear();
    for (const r of list || []) this.roster.set(r.id, r);
    for (const id of [...this.remotes.keys()]) if (!this.roster.has(id)) this.remotes.delete(id);
  },
  nameOf(id) { const r = this.roster.get(id); return r ? r.name : id === this.id ? this.name : '???'; },
  addFeed(text, col) { this.feed.push({ text, col, t: 6 }); if (this.feed.length > 5) this.feed.shift(); },

  onMsg(m) {
    switch (m.t) {
      case 'welcome':
        this.id = m.id; this.color = m.color; this.map = m.map | 0; this.target = m.target || 10;
        this.setRoster(m.roster); this.connected = true;
        this.over = m.over ? { winner: 0, t: 8 } : null;
        if (this.onWelcome) this.onWelcome(m);
        break;
      case 'pong': { // median of the last 5 round trips
        this.pings.push(performance.now() - m.c);
        if (this.pings.length > 5) this.pings.shift();
        const s = this.pings.slice().sort((a, b) => a - b);
        this.ping = Math.round(s[s.length >> 1]);
        break;
      }
      case 'full': if (this.onFail) this.onFail('That duel room is full (8 samurai max). Try another room code.'); break;
      case 'join':
        this.setRoster(m.roster);
        this.addFeed(`${this.nameOf(m.id)} entered the duel`, '#9fe8ff'); Sound.shing();
        break;
      case 'leave':
        this.addFeed(`${this.nameOf(m.id)} left`, '#aaaaaa');
        this.remotes.delete(m.id); this.setRoster(m.roster);
        break;
      case 's':
        if (m.id && m.id !== this.id && this.roster.has(m.id) && Array.isArray(m.j) && m.j.length === JOINTS.length * 2) {
          let r = this.remotes.get(m.id);
          if (!r) { r = new Remote(m.id); this.remotes.set(m.id, r); }
          r.push(m);
        }
        break;
      case 'hit': if (G.mode === 'pvp') G.onNetHit(m); break;
      case 'ouch':
        if (G.mode !== 'pvp') break;
        if (m.by === this.id) { FX.text(m.x, m.y - 20, m.dmg >= 3 ? 'CRIT!' : 'HIT!', '#ffe14a', 16); break; } // blood already shown on swing
        FX.blood(m.x, m.y, 10 + (m.dmg | 0) * 4, rand(-1, 1), -0.5); Sound.slash(m.dmg | 0 || 1);
        break;
      case 'parry':
        if (G.mode !== 'pvp') break;
        if (m.to === this.id) G.player.getParried(m.x, m.y);
        else { FX.parryBurst(m.x, m.y, 0.6); Sound.clang(0.8); }
        break;
      case 'kill': this.setRoster(m.roster); this.onKill(m); break;
      case 'over': this.setRoster(m.roster); this.over = { winner: m.winner, t: 8 }; Sound.gong(); break;
      case 'match':
        this.setRoster(m.roster); this.over = null; this.map = m.map | 0;
        if (G.mode === 'pvp') G.newPvpMatch(this.map);
        break;
      case 'say': {
        const r = this.remotes.get(m.id);
        if (r && r.ready) FX.text(r.x, r.y - 72, TAUNTS_PVP[(m.i | 0) % TAUNTS_PVP.length], '#fff', 13, { bubble: true, life: 1.6, vy: -20 });
        break;
      }
    }
  },
  onKill(m) {
    const v = this.nameOf(m.victim), k = m.killer ? this.nameOf(m.killer) : null;
    const col = m.killer === this.id ? '#ffe14a' : m.victim === this.id ? '#ff8080' : '#ffffff';
    if (k) this.addFeed(`${k}  ⚔  ${v}`, col);
    else this.addFeed(`${v} ${m.cause === 'spikes' ? 'found the spikes' : 'fell into the abyss'}`, col);
    if (m.killer === this.id && G.player) {
      FX.text(G.player.x, G.player.y - 72, pick(['KILL!', 'SLAIN!', 'IPPON!']), '#ffe14a', 26);
      Sound.shing();
    }
    if (m.victim === this.id) G.killedBy = k;
  },
  // timestamped snapshots: ~30/s while anything moves, ~8/s while standing still
  tick(now, p) {
    if (!this.connected || !p) return;
    const sw = p.sword, ls = this.lastSent;
    const still = ls && !p.rag && !p.dead && Math.abs(p.x - ls.x) < 0.5 && Math.abs(p.y - ls.y) < 0.5 &&
      Math.abs(sw.av) < 0.5 && Math.abs(angDiff(sw.ang, ls.a)) < 0.01 && p.netFlags() === ls.fl && p.hp === ls.hp;
    if (now - this.sendT < (still ? 125 : 33)) return;
    this.sendT = now;
    const j = new Array(JOINTS.length * 2);
    for (let i = 0; i < JOINTS.length; i++) { const q = p.pose[JOINTS[i]]; j[2 * i] = Math.round(q.x); j[2 * i + 1] = Math.round(q.y); }
    const s = {
      t: 's', ts: Math.round(now), x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
      f: p.facing, hp: p.hp, fl: p.netFlags(), a: Math.round(sw.ang * 1000) / 1000, av: Math.round(sw.av * 10) / 10, j,
    };
    this.lastSent = s;
    this.send(s);
  },
  update(dt) {
    const now = performance.now();
    for (const r of this.remotes.values()) r.update(now, dt);
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
  },
  // blades crossed: the faster swing wins the parry, the loser is staggered on their own client
  clash(p, r, g) {
    if (r.clashCD > 0) return;
    r.clashCD = 0.2;
    const mine = Math.abs(p.sword.av), theirs = Math.abs(r.av);
    const cx = (g.bx + g.tx + r.bx + r.tx) / 4, cy = (g.by + g.ty + r.by + r.ty) / 4;
    if (mine > 9 && mine > theirs * 1.15 + 2 && p.stun <= 0) {
      this.send({ t: 'parry', to: r.id, x: Math.round(cx), y: Math.round(cy) });
      FX.parryBurst(cx, cy, 1); Sound.parry(); G.shake(8);
      G.hitstop = Math.max(G.hitstop, 0.05);
      FX.text(cx, cy - 30, 'PARRY!', '#fff6a0', 22);
    } else if (mine > 3) {
      Sound.clang(clamp(mine / 30, 0.25, 0.8)); FX.spark(cx, cy, 8, null, TAU, 380);
    }
  },
  taunt() {
    if (!this.connected || !G.player || G.player.dead) return;
    const i = Math.floor(Math.random() * TAUNTS_PVP.length);
    this.send({ t: 'say', i });
    FX.text(G.player.x, G.player.y - 72, TAUNTS_PVP[i], '#fff', 13, { bubble: true, life: 1.6, vy: -20 });
  },
};
