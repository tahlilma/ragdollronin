'use strict';
// ---------- palettes ----------
// stars: 0..1 density · orb: 'moon' | 'sun' · rim: light catching the top edges of distant silhouettes
// brick: dressed stone instead of raw rock · decor: scenery scattered along the ground · fgk: foreground strip
const PALS = {
  road: { skyTop: '#1c1238', skyMid: '#8a3558', skyBot: '#f7a25a', moon: '#ffe2b0', glow: '255,170,110', orb: 'sun', stars: 0.25, rim: '#ffb07a', far: '#6b3458', mid: '#45213f', near: '#2a142b', fog: '#f59a6a', rock: '#3d2a35', rockDark: '#21151d', rockLight: '#684654', grass: '#d99a4a', grassDark: '#8a5230', particle: '#ffb070', pkind: 'ember', fg: '#150a16', lamp: '#ffb070', flower: '#ffd9a0', decor: ['deadTree', 'fence', 'tuft', 'grave', 'rock', 'tuft'], fgk: 'grass' },
  ruins: { skyTop: '#04181f', skyMid: '#12525a', skyBot: '#4fc2b6', moon: '#effff8', glow: '190,255,235', orb: 'moon', stars: 0.8, rim: '#a8f0de', far: '#2b8f8e', mid: '#1b6a70', near: '#0f4a52', fog: '#6ad8c8', rock: '#2b4d5a', rockDark: '#172f3a', rockLight: '#4b7a86', grass: '#cfd64b', grassDark: '#86a12c', particle: '#d8ffb0', pkind: 'firefly', fg: '#041a20', lamp: '#ffe9a8', flower: '#f4f7ff', decor: ['pillar', 'tuft', 'rock', 'tuft', 'pillar', 'fern'], fgk: 'grass' },
  foothills: { skyTop: '#120d0d', skyMid: '#4a2420', skyBot: '#b8603e', moon: '#ffc890', glow: '255,150,90', orb: 'moon', stars: 0.15, rim: '#ff8a50', far: '#6b3a30', mid: '#42231f', near: '#2a1614', fog: '#d9703f', rock: '#3a3030', rockDark: '#1e1818', rockLight: '#5e4e4c', grass: '#8f8478', grassDark: '#57504a', particle: '#cfc4b8', pkind: 'ash', fg: '#0f0808', lamp: '#ff9a5a', decor: ['deadTree', 'crag', 'rock', 'tuft', 'crag', 'rock'], fgk: 'rocks' },
  ember: { skyTop: '#1a0709', skyMid: '#7a2a22', skyBot: '#e2683f', moon: '#ffd9a0', glow: '255,170,110', orb: 'moon', stars: 0.2, rim: '#ffa060', far: '#8a3328', mid: '#561d1d', near: '#3a1214', fog: '#ff8a5a', rock: '#3c2a2c', rockDark: '#211618', rockLight: '#634346', grass: '#e9a43c', grassDark: '#9c5a22', particle: '#ffb35c', pkind: 'ember', fg: '#140506', lamp: '#ffb070', flower: '#ffe08a', decor: ['deadTree', 'rock', 'tuft', 'torii', 'tuft', 'rock'], fgk: 'grass' },
  steps: { skyTop: '#27376e', skyMid: '#c9789c', skyBot: '#ffdcae', moon: '#fff4dc', glow: '255,210,180', orb: 'sun', stars: 0.3, rim: '#ffd0c0', far: '#9a86b8', mid: '#665a8e', near: '#3f3a66', fog: '#ffd2c2', rock: '#474a6c', rockDark: '#2a2c46', rockLight: '#6f7399', grass: '#fdf6f2', grassDark: '#c9b8d0', particle: '#ffffff', pkind: 'snow', fg: '#141428', lamp: '#ffe0c0', decor: ['pine', 'stoneLantern', 'rock', 'tuft', 'pine', 'torii'], fgk: 'pine' },
  peaks: { skyTop: '#0f2444', skyMid: '#4f7fae', skyBot: '#b4dde6', moon: '#ffffff', glow: '220,240,255', orb: 'moon', stars: 0.5, rim: '#e8f6ff', far: '#7c9fc0', mid: '#4d6c92', near: '#2f4766', fog: '#d2ecf5', rock: '#3a4a66', rockDark: '#222d42', rockLight: '#5f7393', grass: '#eef4ff', grassDark: '#a9bfd9', particle: '#ffffff', pkind: 'snow', fg: '#0b1424', lamp: '#e9f4ff', decor: ['pine', 'rock', 'tuft', 'pine', 'rock', 'crag'], fgk: 'pine' },
  woods: { skyTop: '#020d0b', skyMid: '#0c3528', skyBot: '#2a7a52', moon: '#f2ffe0', glow: '200,255,190', orb: 'moon', stars: 0.6, rim: '#8fe0a0', far: '#1f6a4a', mid: '#124a36', near: '#0a3024', fog: '#58c890', rock: '#28423a', rockDark: '#152822', rockLight: '#456a5c', grass: '#7fd35a', grassDark: '#3f8a3a', particle: '#f0ffa0', pkind: 'firefly', fg: '#020f0b', lamp: '#ffc46a', flower: '#fff2b0', decor: ['bamboo', 'bamboo', 'tuft', 'stoneLantern', 'fern', 'bamboo'], fgk: 'bamboo' },
  shrine: { skyTop: '#0d0720', skyMid: '#472a7a', skyBot: '#8a50b8', moon: '#fff0ff', glow: '255,200,255', orb: 'moon', stars: 0.9, rim: '#f0b0ff', far: '#5a3488', mid: '#36205e', near: '#22143f', fog: '#c08ae0', rock: '#2d2444', rockDark: '#18122b', rockLight: '#4a3c6e', grass: '#f08cc4', grassDark: '#a2457e', particle: '#ffc2e2', pkind: 'petal', fg: '#0a0616', lamp: '#8fe3ff', flower: '#ffffff', decor: ['sakura', 'stoneLantern', 'tuft', 'torii', 'sakura', 'tuft'], fgk: 'grass' },
  wall: { skyTop: '#06080f', skyMid: '#1c2536', skyBot: '#46546a', moon: '#dfe8f5', glow: '170,190,220', orb: 'moon', stars: 0, rim: '#9fb0c8', far: '#34405a', mid: '#222b40', near: '#161c2c', fog: '#7a8aa6', rock: '#343a4a', rockDark: '#1b1f2a', rockLight: '#555d72', grass: '#6f7f8a', grassDark: '#434e58', particle: '#c8d8f0', pkind: 'rain', fg: '#05070c', lamp: '#ffb26a', brick: true, storm: true, decor: ['banner', 'fence', 'rock', 'banner', 'stoneLantern', 'tuft'], fgk: 'rocks' },
  castle: { skyTop: '#140304', skyMid: '#5a1012', skyBot: '#a02420', moon: '#ff5a4e', glow: '255,90,70', orb: 'moon', stars: 0.25, rim: '#ff7a5a', far: '#5a1414', mid: '#360b0c', near: '#220607', fog: '#c2402e', rock: '#2c2325', rockDark: '#150f10', rockLight: '#4a3c3e', grass: '#cfa86a', grassDark: '#7d5a30', particle: '#ff9878', pkind: 'ash', fg: '#0a0202', lamp: '#ff8a5a', brick: true, decor: ['banner', 'stoneLantern', 'rock', 'banner', 'tuft', 'fence'], fgk: 'rocks' },
};

// hex colour maths (shade() returns rgb() strings, which can't be mixed again)
function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, t));
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

const CHUNK = 16;
// tile codes: 0 empty, 1 solid, 2 one-way, 3..6 spikes (up, down, right, left)

class Level {
  constructor(cols, rows, pal) {
    this.cols = cols; this.rows = rows; this.pal = pal;
    this.tiles = new Uint8Array(cols * rows);
    this.width = cols * T; this.height = rows * T;
    this.chunks = new Map();
    this.spawns = []; this.signs = []; this.shrines = []; this.lanterns = []; this.spawnPts = [];
    this.decor = []; this.ambushes = []; this.goal = null;
    this.arena = null; this.start = { x: 100, y: 100 };
  }
  get(tx, ty) {
    if (tx < 0 || tx >= this.cols) return 1;
    if (ty >= this.rows) return 0;
    if (ty < 0) ty = 0; // columns extend upward forever
    return this.tiles[ty * this.cols + tx];
  }
  set(tx, ty, v) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return;
    this.tiles[ty * this.cols + tx] = v;
    const ci = Math.floor(tx / CHUNK);
    this.chunks.delete(ci); this.chunks.delete(ci - 1); this.chunks.delete(ci + 1);
  }
  solid(tx, ty) { return this.get(tx, ty) === 1; }
  solidAt(x, y) { return this.get(Math.floor(x / T), Math.floor(y / T)) === 1; }
  tileAt(x, y) { return this.get(Math.floor(x / T), Math.floor(y / T)); }
  groundBelow(x, y, maxRows = 6) {
    const tx = Math.floor(x / T), ty0 = Math.floor(y / T);
    for (let ty = ty0; ty < ty0 + maxRows && ty < this.rows; ty++) {
      const t = this.get(tx, ty);
      if (t === 1 || t === 2) return ty * T;
    }
    return null;
  }
  boxSolid(x, y, w, h) {
    const x0 = Math.floor((x - w / 2) / T), x1 = Math.floor((x + w / 2 - 1) / T);
    const y0 = Math.floor((y - h / 2) / T), y1 = Math.floor((y + h / 2 - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
    return false;
  }
  hazardIn(r) {
    const x0 = Math.floor(r.x / T), x1 = Math.floor((r.x + r.w) / T);
    const y0 = Math.floor(r.y / T), y1 = Math.floor((r.y + r.h) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = this.get(tx, ty);
      if (t >= 3 && rectsOverlap(r, { x: tx * T + 7, y: ty * T + 7, w: T - 14, h: T - 14 })) return t;
    }
    return 0;
  }
  // terrain is baked into wide strips: scenery first, then the tiles over it
  chunk(ci) {
    let c = this.chunks.get(ci);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = CHUNK * T; c.height = this.rows * T;
    const g = c.getContext('2d');
    const ox = ci * CHUNK * T;
    for (const d of this.decor) {
      if (d.x < ox - 170 || d.x > ox + CHUNK * T + 170) continue;
      const fn = DECOR[d.type];
      if (fn) { g.save(); g.translate(d.x - ox, d.y); fn(g, this.pal, mulberry32(d.seed)); g.restore(); }
    }
    for (let cc = 0; cc < CHUNK; cc++) {
      const col = ci * CHUNK + cc;
      if (col < 0 || col >= this.cols) continue;
      for (let r = 0; r < this.rows; r++) drawTile(g, this, col, r, cc * T, r * T);
    }
    this.chunks.set(ci, c);
    return c;
  }
  draw(ctx, x0, x1) {
    const c0 = Math.floor(x0 / (CHUNK * T)), c1 = Math.floor(x1 / (CHUNK * T));
    for (let ci = Math.max(0, c0); ci <= c1; ci++) {
      if (ci * CHUNK >= this.cols) break;
      ctx.drawImage(this.chunk(ci), ci * CHUNK * T, 0);
    }
  }
}

// axis-separated AABB vs tile collision. b: {x,y (center), w,h, vx,vy}
function moveBody(b, dt, L) {
  b.grounded = false; b.hitWall = 0; b.hitCeil = false; b.onOneWay = false;
  const hw = b.w / 2, hh = b.h / 2;
  if (b.vx !== 0) {
    let nx = b.x + b.vx * dt;
    const top = Math.floor((b.y - hh + 1) / T), bot = Math.floor((b.y + hh - 1) / T);
    if (b.vx > 0) {
      const tx = Math.floor((nx + hw) / T);
      for (let ty = top; ty <= bot; ty++) if (L.solid(tx, ty)) { nx = tx * T - hw - 0.01; b.vx = 0; b.hitWall = 1; break; }
    } else {
      const tx = Math.floor((nx - hw) / T);
      for (let ty = top; ty <= bot; ty++) if (L.solid(tx, ty)) { nx = (tx + 1) * T + hw + 0.01; b.vx = 0; b.hitWall = -1; break; }
    }
    b.x = nx;
  }
  let ny = b.y + b.vy * dt;
  const left = Math.floor((b.x - hw + 1) / T), right = Math.floor((b.x + hw - 1) / T);
  if (b.vy >= 0) {
    const ty = Math.floor((ny + hh) / T);
    const prevBottom = b.y + hh;
    for (let tx = left; tx <= right; tx++) {
      const t = L.get(tx, ty);
      if (t === 1 || (t === 2 && !b.dropThrough && prevBottom <= ty * T + 1)) {
        ny = ty * T - hh; b.vy = 0; b.grounded = true;
        if (t === 2) b.onOneWay = true;
        break;
      }
    }
  } else {
    const ty = Math.floor((ny - hh) / T);
    for (let tx = left; tx <= right; tx++) if (L.solid(tx, ty)) { ny = (ty + 1) * T + hh + 0.01; b.vy = 0; b.hitCeil = true; break; }
  }
  b.y = ny;
}

// ---------- level builder ----------
class Builder {
  constructor(rows = 18) {
    this.rows = rows; this.cells = []; this.cx = 0; this.seg = 0;
    this.spawns = []; this.signs = []; this.shrines = []; this.lanterns = []; this.spawnCols = [];
    this.arenaDef = null; this.startCol = 3; this.ambushDefs = []; this.goalCol = -1;
  }
  ensure(c) { while (this.cells.length <= c) this.cells.push(new Uint8Array(this.rows)); }
  fill(c0, r0, w, h, v) {
    for (let c = c0; c < c0 + w; c++) {
      if (c < 0) continue;
      this.ensure(c);
      for (let r = r0; r < r0 + h; r++) if (r >= 0 && r < this.rows) this.cells[c][r] = v;
    }
  }
  topAt(c) {
    this.ensure(c);
    for (let r = 0; r < this.rows; r++) { const v = this.cells[c][r]; if (v === 1 || v === 2) return r; }
    return this.rows;
  }
  ground(len, top = 14) { this.seg = this.cx; this.fill(this.cx, top, len, this.rows - top, 1); this.cx += len; return this; }
  pit(len) { this.seg = this.cx; this.ensure(this.cx + len - 1); this.cx += len; return this; }
  block(dx, row, w, h) { this.fill(this.seg + dx, row, w, h, 1); return this; }
  plat(dx, row, w) { this.fill(this.seg + dx, row, w, 1, 2); return this; }
  spikes(dx, w) {
    for (let c = this.seg + dx; c < this.seg + dx + w; c++) { const r = this.topAt(c); if (r > 0 && r < this.rows) this.cells[c][r - 1] = 3; }
    return this;
  }
  enemy(type, dx, opts = {}) { this.spawns.push({ type, c: this.seg + dx, opts }); return this; }
  sign(dx, text) { this.signs.push({ c: this.seg + dx, text }); return this; }
  shrine(dx) { this.shrines.push({ c: this.seg + dx }); return this; }
  lantern(dx) { this.lanterns.push({ c: this.seg + dx }); return this; }
  start(dx) { this.startCol = this.seg + dx; return this; }
  spawn(dx) { this.spawnCols.push(this.seg + dx); return this; } // PvP respawn point
  goal(dx) { this.goalCol = this.seg + dx; return this; }        // reaching this gate clears a stage with no boss
  wall() { return this.ground(2, 0); }
  // a flat killing floor: gates slam shut and waves of [type, dx, opts] drop in until all are dead
  ambush(len, waves, o = {}) {
    const c0 = this.cx, top = o.top || 14;
    this.seg = c0;
    this.fill(c0, top, len, this.rows - top, 1);
    for (const [dx, row, w] of o.plats || []) this.fill(c0 + dx, row, w, 1, 2);
    this.ambushDefs.push({ c0, c1: c0 + len, top, waves });
    this.cx += len;
    return this;
  }
  arena(len, boss, o = {}) {
    const c0 = this.cx, top = o.top || 14;
    this.seg = c0;
    this.fill(c0, top, len, this.rows - top, 1);
    this.fill(c0 + len - 2, 0, 2, top, 1);
    for (const [dx, row, w] of o.plats || []) this.fill(c0 + dx, row, w, 1, 2);
    const def = { c0, c1: c0 + len, top, boss, gateSpikes: [] };
    if (o.spikeWalls) {
      for (let r = top - 5; r < top; r++) {
        this.cells[c0 + len - 3][r] = 6;
        def.gateSpikes.push([c0 + 1, r, 5]);
      }
    }
    this.arenaDef = def;
    this.cx += len;
    return this;
  }
  build(pal) {
    const cols = this.cells.length;
    const L = new Level(cols, this.rows, pal);
    for (let c = 0; c < cols; c++) for (let r = 0; r < this.rows; r++) L.tiles[r * cols + c] = this.cells[c][r];
    const yAt = (c) => this.topAt(c) * T;
    L.start = { x: this.startCol * T + T / 2, y: yAt(this.startCol) - 30 };
    L.spawns = this.spawns.map((s) => ({ type: s.type, x: s.c * T + T / 2, y: yAt(s.c), opts: s.opts }));
    L.signs = this.signs.map((s) => ({ x: s.c * T + T / 2, y: yAt(s.c), text: s.text }));
    L.shrines = this.shrines.map((s) => ({ x: s.c * T + T / 2, y: yAt(s.c), used: false }));
    L.lanterns = this.lanterns.map((s) => ({ x: s.c * T + T / 2, y: yAt(s.c), ph: Math.random() * 6 }));
    L.spawnPts = this.spawnCols.map((c) => ({ x: c * T + T / 2, y: yAt(c) }));
    L.arena = this.arenaDef ? Object.assign({ started: false }, this.arenaDef) : null;
    L.ambushes = this.ambushDefs.map((a) => Object.assign({ state: 0, wave: -1, foes: [], wait: 0 }, a));
    if (this.goalCol >= 0) L.goal = { x: this.goalCol * T + T / 2, y: yAt(this.goalCol) };
    this.scatter(L, pal);
    return L;
  }
  // scenery: trees, stones, banners... sprinkled over open ground, clear of anything you need to read
  scatter(L, pal) {
    const kinds = pal.decor;
    if (!kinds) return;
    const R = mulberry32(L.cols * 131 + kinds.length * 17 + 5);
    const busy = new Set();
    const mark = (c, n) => { for (let i = -n; i <= n; i++) busy.add(c + i); };
    for (const s of this.signs) mark(s.c, 1);
    for (const s of this.shrines) mark(s.c, 2);
    for (const s of this.lanterns) mark(s.c, 1);
    if (this.goalCol >= 0) mark(this.goalCol, 3);
    const small = { tuft: 1, rock: 1, fern: 1, grave: 1, fence: 1 };
    for (let c = 1; c < L.cols - 1; c++) {
      const top = this.topAt(c);
      if (top >= this.rows || top < 4 || this.cells[c][top] !== 1 || this.cells[c][top - 1] !== 0 || busy.has(c)) continue;
      if (R() > 0.34) continue;
      let type = kinds[Math.floor(R() * kinds.length)];
      let room = true;
      for (let r = top - 5; r < top; r++) if (r >= 0 && this.cells[c][r] !== 0) room = false;
      const inFight = (this.arenaDef && c >= this.arenaDef.c0) || this.ambushDefs.some((a) => c >= a.c0 && c < a.c1);
      if (!small[type] && (!room || (inFight && R() < 0.6))) type = 'tuft';
      L.decor.push({ type, x: c * T + T / 2 + (R() - 0.5) * 16, y: top * T, seed: Math.floor(R() * 1e9) });
      if (!small[type]) c += 1;
    }
  }
}

// ---------- terrain tile rendering ----------
function drawTile(g, L, c, r, x, y) {
  const t = L.get(c, r), pal = L.pal;
  if (t === 1) {
    const h = hash2(c, r), h2 = hash2(c + 91, r * 3 + 7), h3 = hash2(c * 7 + 3, r + 11);
    const open = (v) => v !== 1;
    const top = r > 0 && open(L.get(c, r - 1));
    g.fillStyle = pal.rock; g.fillRect(x, y, T, T);
    if (pal.brick) {
      // dressed stone: two courses per tile, staggered joints
      for (let k = 0; k < 2; k++) {
        const by = y + k * 20, off = ((r * 2 + k) % 2) * 20, hv = hash2(c * 5 + k, r * 9 + k);
        g.globalAlpha = 0.1 + hv * 0.16; g.fillStyle = hv < 0.5 ? pal.rockLight : pal.rockDark;
        g.fillRect(x, by, T, 20);
        g.globalAlpha = 0.5; g.fillStyle = pal.rockDark;
        g.fillRect(x, by + 19, T, 1.5);
        g.fillRect(x + off, by, 1.5, 20);
        g.globalAlpha = 0.22; g.fillStyle = pal.rockLight; g.fillRect(x, by, T, 1.5);
      }
    } else {
      // low-poly facets
      g.globalAlpha = 0.16 + h2 * 0.22;
      g.fillStyle = h < 0.5 ? pal.rockLight : pal.rockDark;
      g.beginPath();
      if (h2 < 0.5) { g.moveTo(x, y); g.lineTo(x + T, y); g.lineTo(x + h3 * T * 0.6, y + T); }
      else { g.moveTo(x + T, y); g.lineTo(x + T, y + T); g.lineTo(x + h3 * T * 0.4, y + T * 0.3); }
      g.closePath(); g.fill();
      // strata: a soft band across the rock
      g.globalAlpha = 0.13; g.fillStyle = h3 < 0.5 ? pal.rockLight : pal.rockDark;
      const sy = y + 6 + hash2(7, r) * 24;
      g.beginPath(); g.moveTo(x, sy); g.lineTo(x + T, sy + (hash2(c + 1, r) - 0.5) * 6); g.lineTo(x + T, sy + 4); g.lineTo(x, sy + 5); g.closePath(); g.fill();
    }
    // speckle
    g.globalAlpha = 0.22;
    for (let k = 0; k < 3; k++) {
      const hx = hash2(c * 17 + k, r * 13), hy = hash2(c * 3, r * 29 + k);
      g.fillStyle = k ? pal.rockDark : pal.rockLight;
      g.fillRect(x + hx * (T - 3), y + hy * (T - 3), 2 + hx * 2, 2);
    }
    // depth darkening
    let depth = 0;
    for (let k = 1; k <= 5; k++) { if (r - k >= 0 && L.get(c, r - k) === 1) depth++; else break; }
    if (depth) { g.globalAlpha = Math.min(0.5, depth * 0.09); g.fillStyle = '#000'; g.fillRect(x, y, T, T); }
    g.globalAlpha = 1;
    if (h > 0.84 && !pal.brick) {
      g.strokeStyle = pal.rockDark; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + h2 * T, y + 8); g.lineTo(x + h3 * T, y + T * 0.55); g.lineTo(x + h2 * T * 0.6 + 6, y + T - 4); g.stroke();
    }
    if (open(L.get(c - 1, r)) && c > 0) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y, 5, T);
      g.globalAlpha = 0.45; g.fillStyle = pal.rockLight; g.fillRect(x, y, 2, T); g.globalAlpha = 1;
    }
    if (open(L.get(c + 1, r)) && c < L.cols - 1) { g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(x + T - 6, y, 6, T); }
    if (r + 1 < L.rows && open(L.get(c, r + 1))) {
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x, y + T - 6, T, 6);
      g.strokeStyle = pal.grassDark; g.lineWidth = 1.2;
      for (let k = 0; k < 2; k++) {
        if (hash2(c * 3 + k, r * 5) < 0.55) continue;
        const vx = x + hash2(c + k, r) * T, len = 10 + hash2(c, r + k) * 30;
        g.beginPath(); g.moveTo(vx, y + T); g.quadraticCurveTo(vx + 4, y + T + len * 0.5, vx - 2, y + T + len); g.stroke();
      }
    }
    if (top) {
      // soil lip with a scalloped lower edge, then the turf (or snow) on top
      g.fillStyle = pal.grassDark;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + T, y); g.lineTo(x + T, y + 9);
      for (let k = 3; k >= 0; k--) g.quadraticCurveTo(x + k * 10 + 5, y + 9 + 3 + hash2(c * 4 + k, r) * 5, x + k * 10, y + 9);
      g.closePath(); g.fill();
      g.fillStyle = pal.grass; g.fillRect(x, y, T, 6);
      for (let k = 0; k < 8; k++) {
        const hh = hash2(c * 13 + k, r * 7 + k);
        const bx = x + hh * T, bh = 3 + hash2(c + k * 5, r) * 9;
        g.beginPath(); g.moveTo(bx - 2.5, y + 2); g.lineTo(bx + 2.5, y + 2); g.lineTo(bx + (hh - 0.5) * 6, y - bh); g.closePath(); g.fill();
      }
      g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; g.fillRect(x, y, T, 1.5); g.globalAlpha = 1; // light catching the edge
      if (pal.flower && h3 > 0.8) {
        const fx = x + 6 + h * 28;
        g.strokeStyle = pal.grassDark; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, y + 1); g.lineTo(fx + 1, y - 8); g.stroke();
        g.fillStyle = pal.flower; g.beginPath(); g.arc(fx + 1, y - 9, 2.2, 0, TAU); g.fill();
      }
      g.fillStyle = pal.grass;
      if (open(L.get(c - 1, r))) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.lineTo(x - 2, y + 14); g.closePath(); g.fill(); }
      if (open(L.get(c + 1, r))) { g.beginPath(); g.moveTo(x + T, y); g.lineTo(x + T - 6, y + 8); g.lineTo(x + T + 2, y + 14); g.closePath(); g.fill(); }
    }
  } else if (t === 2) {
    // timber walkway: planks on a beam, capped with whatever grows here
    const wood = mixHex('#6b4a2e', pal.rock, 0.4), woodD = mixHex('#2e1d12', pal.rockDark, 0.4), woodL = mixHex('#a37a4c', pal.rockLight, 0.35);
    g.fillStyle = woodD; g.fillRect(x, y + 10, T, 7);
    g.fillStyle = wood; g.fillRect(x, y + 3, T, 9);
    g.fillStyle = woodL; g.fillRect(x, y + 3, T, 2);
    g.fillStyle = woodD;
    g.fillRect(x + 19, y + 3, 1.5, 9);
    g.fillRect(x + 4 + hash2(c, r) * 8, y + 7, 9, 1);
    g.fillStyle = pal.grass; g.fillRect(x, y, T, 4);
    for (let k = 0; k < 4; k++) {
      const bx = x + hash2(c * 5 + k, r) * T, bh = 2 + hash2(c, r + k) * 6;
      g.beginPath(); g.moveTo(bx - 2, y + 1); g.lineTo(bx + 2, y + 1); g.lineTo(bx, y - bh); g.closePath(); g.fill();
    }
    g.globalAlpha = 0.45; g.fillStyle = '#ffffff'; g.fillRect(x, y, T, 1.2); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 16, T, 3);
    g.fillStyle = woodD;
    if (L.get(c - 1, r) !== 2) { g.beginPath(); g.moveTo(x + 3, y + 17); g.lineTo(x + 10, y + 17); g.lineTo(x + 3, y + 30); g.closePath(); g.fill(); }
    if (L.get(c + 1, r) !== 2) { g.beginPath(); g.moveTo(x + T - 3, y + 17); g.lineTo(x + T - 10, y + 17); g.lineTo(x + T - 3, y + 30); g.closePath(); g.fill(); }
  } else if (t >= 3) {
    g.save();
    g.translate(x + T / 2, y + T / 2);
    g.rotate({ 3: 0, 4: Math.PI, 5: Math.PI / 2, 6: -Math.PI / 2 }[t]);
    g.fillStyle = '#14181d'; g.fillRect(-T / 2, T / 2 - 6, T, 6);
    for (let i = 0; i < 4; i++) {
      const bx = -T / 2 + 5 + i * 10;
      g.fillStyle = '#c4ced6';
      g.beginPath(); g.moveTo(bx - 5, T / 2 - 5); g.lineTo(bx + 5, T / 2 - 5); g.lineTo(bx, -T / 2 + 8); g.closePath(); g.fill();
      g.fillStyle = '#687480';
      g.beginPath(); g.moveTo(bx, T / 2 - 5); g.lineTo(bx + 5, T / 2 - 5); g.lineTo(bx, -T / 2 + 8); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(bx - 0.6, -T / 2 + 8, 1.2, 5);
    }
    g.restore();
  }
}

// ---------- scenery baked behind the terrain. Drawn at the origin = where it meets the ground ----------
// Two tones per palette: a dark body and a rim that catches the light, so scenery sits behind the action.
function decorCols(pal) {
  if (!pal._dc) pal._dc = { body: mixHex(pal.near, pal.rockDark, 0.45), rim: mixHex(mixHex(pal.near, pal.rockDark, 0.45), pal.rim || pal.fog, 0.3), leaf: mixHex(pal.grassDark, pal.near, 0.45), leafL: mixHex(pal.grass, pal.near, 0.35) };
  return pal._dc;
}
const DECOR = {
  tuft(g, pal, R) {
    const d = decorCols(pal);
    for (let i = 0; i < 7; i++) {
      const x = (R() - 0.5) * 26, h = 10 + R() * 20, lean = (R() - 0.5) * 16;
      g.fillStyle = i % 2 ? d.leaf : d.leafL;
      g.beginPath(); g.moveTo(x - 2, 2); g.quadraticCurveTo(x + lean * 0.3, -h * 0.6, x + lean, -h); g.quadraticCurveTo(x + lean * 0.5, -h * 0.5, x + 2, 2); g.closePath(); g.fill();
    }
  },
  fern(g, pal, R) {
    const d = decorCols(pal);
    g.strokeStyle = d.leafL; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42 + (R() - 0.5) * 0.2, l = 20 + R() * 14;
      g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(Math.cos(a) * l * 0.6, Math.sin(a) * l, Math.cos(a) * l * 1.3, Math.sin(a) * l * 0.55); g.stroke();
    }
  },
  rock(g, pal, R) {
    const d = decorCols(pal), w = 12 + R() * 16, h = 8 + R() * 12;
    g.fillStyle = d.body; g.beginPath(); g.moveTo(-w, 3); g.lineTo(-w * 0.7, -h * 0.7); g.lineTo(-w * 0.1, -h); g.lineTo(w * 0.6, -h * 0.75); g.lineTo(w, 3); g.closePath(); g.fill();
    g.fillStyle = d.rim; g.beginPath(); g.moveTo(-w * 0.7, -h * 0.7); g.lineTo(-w * 0.1, -h); g.lineTo(w * 0.6, -h * 0.75); g.lineTo(-w * 0.05, -h * 0.55); g.closePath(); g.fill();
  },
  crag(g, pal, R) {
    const d = decorCols(pal), h = 60 + R() * 70, w = 16 + R() * 12, lean = (R() - 0.5) * 24;
    g.fillStyle = d.body; g.beginPath(); g.moveTo(-w, 3); g.lineTo(lean - 3, -h); g.lineTo(lean + 5, -h * 0.9); g.lineTo(w, 3); g.closePath(); g.fill();
    g.fillStyle = d.rim; g.beginPath(); g.moveTo(-w, 3); g.lineTo(lean - 3, -h); g.lineTo(lean - 1, -h * 0.55); g.lineTo(-w * 0.45, 3); g.closePath(); g.fill();
  },
  deadTree(g, pal, R) {
    const d = decorCols(pal), h = 90 + R() * 70;
    g.strokeStyle = d.body; g.lineCap = 'round'; g.lineWidth = 9;
    const bx = (R() - 0.5) * 30;
    g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(6, -h * 0.5, bx, -h); g.stroke();
    for (let i = 0; i < 5; i++) {
      const t = 0.35 + i * 0.13, x = bx * t * t + 3 * t, y = -h * t, dir = i % 2 ? 1 : -1, l = 24 + R() * 34;
      g.lineWidth = 4 - i * 0.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dir * l * 0.6, y - 4, x + dir * l, y - 14 - R() * 22); g.stroke();
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x + dir * l * 0.6, y - 6); g.lineTo(x + dir * l * 0.8, y - 26 - R() * 10); g.stroke();
    }
    g.strokeStyle = d.rim; g.lineWidth = 2; g.beginPath(); g.moveTo(-3, 2); g.quadraticCurveTo(2, -h * 0.5, bx - 2, -h + 4); g.stroke();
  },
  pine(g, pal, R) {
    const d = decorCols(pal), h = 110 + R() * 70;
    g.fillStyle = d.body; g.fillRect(-4, -h * 0.35, 8, h * 0.35 + 4);
    for (let i = 0; i < 5; i++) {
      const w = h * (0.34 - i * 0.055), y = -h * 0.22 - i * h * 0.16;
      g.fillStyle = d.body; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.lineTo(0, y - h * 0.3); g.closePath(); g.fill();
      g.fillStyle = pal.pkind === 'snow' ? mixHex(pal.grass, pal.near, 0.35) : d.rim; // snow (or light) on the boughs
      g.beginPath(); g.moveTo(-w, y); g.lineTo(-w * 0.2, y - h * 0.05); g.lineTo(0, y - h * 0.3); g.lineTo(-w * 0.45, y - h * 0.1); g.closePath(); g.fill();
    }
  },
  bamboo(g, pal, R) {
    const d = decorCols(pal);
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 13 + (R() - 0.5) * 6, h = 150 + R() * 110, lean = (R() - 0.5) * 20, w = 5 + R() * 2.5;
      g.strokeStyle = k === 1 ? d.leafL : d.leaf; g.lineWidth = w; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x, 4); g.quadraticCurveTo(x + lean * 0.2, -h * 0.5, x + lean, -h); g.stroke();
      g.strokeStyle = d.body; g.lineWidth = 1.4;
      for (let j = 1; j < 8; j++) { const t = j / 8, px = x + lean * t * t, py = -h * t; g.beginPath(); g.moveTo(px - w / 2 - 1, py); g.lineTo(px + w / 2 + 1, py); g.stroke(); }
      g.fillStyle = d.leafL;
      for (let j = 0; j < 7; j++) {
        const t = 0.55 + R() * 0.45, px = x + lean * t * t, py = -h * t, a = (R() - 0.5) * 2.2, l = 16 + R() * 14;
        g.save(); g.translate(px, py); g.rotate(a);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -4, l, 2); g.quadraticCurveTo(l * 0.5, 3, 0, 0); g.fill();
        g.restore();
      }
    }
  },
  sakura(g, pal, R) {
    const d = decorCols(pal), h = 95 + R() * 50;
    g.strokeStyle = d.body; g.lineCap = 'round'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(-10, -h * 0.4, 6, -h * 0.7); g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(2, -h * (0.45 + i * 0.07)); g.lineTo((R() - 0.5) * h * 0.9, -h * (0.7 + R() * 0.2)); g.stroke(); }
    const pink = mixHex(pal.grass, pal.near, 0.3), pinkL = mixHex(pal.grass, '#ffffff', 0.3);
    for (let i = 0; i < 16; i++) {
      const x = (R() - 0.5) * h * 1.05, y = -h * (0.62 + R() * 0.42), rr = 12 + R() * 18;
      g.fillStyle = i % 3 ? pink : pinkL; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  },
  pillar(g, pal, R) {
    const d = decorCols(pal), h = 70 + R() * 90, w = 20 + R() * 12;
    g.fillStyle = d.body; g.fillRect(-w / 2, -h, w, h + 4);
    g.fillRect(-w / 2 - 5, -h - 8, w + 10, 9);
    g.fillRect(-w / 2 - 4, -6, w + 8, 10);
    g.fillStyle = d.rim; g.fillRect(-w / 2, -h, 4, h); g.fillRect(-w / 2 - 5, -h - 8, w + 10, 2.5);
    if (R() < 0.5) { g.fillStyle = d.body; g.beginPath(); g.moveTo(-w / 2 - 5, -h - 8); g.lineTo(-w * 0.1, -h - 24 - R() * 20); g.lineTo(w / 2 + 5, -h - 8); g.closePath(); g.fill(); }
    g.strokeStyle = d.leaf; g.lineWidth = 2; // ivy
    for (let k = 0; k < 3; k++) { const vx = -w / 2 + R() * w, l = 20 + R() * (h - 30); g.beginPath(); g.moveTo(vx, -h); g.quadraticCurveTo(vx + 7, -h + l * 0.5, vx - 3, -h + l); g.stroke(); }
  },
  stoneLantern(g, pal) {
    const d = decorCols(pal);
    g.fillStyle = d.body;
    g.fillRect(-9, -5, 18, 9); g.fillRect(-4, -30, 8, 26); g.fillRect(-10, -34, 20, 5); g.fillRect(-7, -48, 14, 14);
    g.beginPath(); g.moveTo(-17, -47); g.quadraticCurveTo(0, -52, 17, -47); g.lineTo(5, -60); g.lineTo(-5, -60); g.closePath(); g.fill();
    g.fillRect(-2, -66, 4, 7);
    g.fillStyle = d.rim; g.fillRect(-4, -30, 2.5, 26); g.fillRect(-10, -34, 20, 1.5);
    g.fillStyle = hexA(pal.lamp, 0.85); g.fillRect(-3.5, -45, 7, 8);
  },
  banner(g, pal, R) {
    const d = decorCols(pal), h = 120 + R() * 30;
    const cloth = mixHex(pal.banner || '#a3262e', pal.near, 0.35);
    g.fillStyle = d.body; g.fillRect(-2, -h, 4, h + 4); g.fillRect(-2, -h + 4, 26, 3);
    g.fillStyle = cloth;
    g.beginPath(); g.moveTo(3, -h + 7); g.lineTo(24, -h + 7);
    g.quadraticCurveTo(27, -h * 0.6, 22, -h * 0.28); g.lineTo(3, -h * 0.3); g.closePath(); g.fill();
    g.fillStyle = mixHex(cloth, '#ffffff', 0.5);
    g.beginPath(); g.arc(13, -h * 0.72, 5.5, 0, TAU); g.fill();
    g.fillStyle = cloth; g.fillRect(8, -h * 0.72 - 1, 10, 2);
  },
  fence(g, pal, R) {
    const d = decorCols(pal);
    g.fillStyle = d.body;
    for (let i = -2; i <= 2; i++) { const hh = 22 + R() * 10; g.fillRect(i * 13 - 2.5, -hh, 5, hh + 3); }
    g.save(); g.rotate((R() - 0.5) * 0.08); g.fillRect(-32, -18, 64, 4); g.fillRect(-32, -8, 64, 3); g.restore();
    g.fillStyle = d.rim; for (let i = -2; i <= 2; i++) g.fillRect(i * 13 - 2.5, -22, 1.5, 20);
  },
  grave(g, pal, R) {
    const d = decorCols(pal), h = 26 + R() * 14;
    g.save(); g.rotate((R() - 0.5) * 0.25);
    g.fillStyle = d.body; g.fillRect(-7, -h, 14, h + 4); g.fillRect(-11, -4, 22, 7);
    g.fillStyle = d.rim; g.fillRect(-7, -h, 3, h); g.fillRect(-7, -h, 14, 2);
    g.restore();
  },
  torii(g, pal, R) {
    const d = decorCols(pal), h = 120 + R() * 30, w = h * 0.8;
    const red = mixHex('#c3262f', pal.near, 0.4);
    g.fillStyle = red;
    g.fillRect(-w * 0.38, -h, 9, h + 4); g.fillRect(w * 0.38 - 9, -h, 9, h + 4);
    g.fillRect(-w * 0.48, -h * 0.8, w * 0.96, 7);
    g.fillStyle = d.body;
    g.beginPath(); g.moveTo(-w * 0.62, -h * 1.03); g.quadraticCurveTo(0, -h * 0.94, w * 0.62, -h * 1.03);
    g.lineTo(w * 0.55, -h * 0.91); g.quadraticCurveTo(0, -h * 0.85, -w * 0.55, -h * 0.91); g.closePath(); g.fill();
    g.fillRect(-w * 0.38 - 2, -5, 13, 8); g.fillRect(w * 0.38 - 11, -5, 13, 8);
    g.fillStyle = mixHex(red, '#ffffff', 0.25); g.fillRect(-w * 0.38, -h, 2.5, h);
  },
};

// ---------- world props (lanterns, shrines, signs, the goal gate) ----------
function drawLantern(ctx, l, pal, time) {
  const x = l.x, y = l.y;
  const fl = 0.85 + Math.sin(time * 7 + l.ph) * 0.08 + Math.sin(time * 13 + l.ph) * 0.05;
  Gfx.glow(ctx, x, y - 38, 96, pal.lamp, 0.5 * fl);
  ctx.fillStyle = '#10161a';
  ctx.fillRect(x - 9, y - 6, 18, 6);
  ctx.fillRect(x - 3, y - 30, 6, 24);
  ctx.fillRect(x - 8, y - 32, 16, 3);
  ctx.fillStyle = pal.lamp; ctx.globalAlpha = fl;
  ctx.fillRect(x - 6, y - 45, 12, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 42, 4, 6);
  ctx.fillStyle = '#10161a';
  ctx.fillRect(x - 0.6, y - 45, 1.2, 12);
  ctx.beginPath(); ctx.moveTo(x - 14, y - 44); ctx.quadraticCurveTo(x, y - 47, x + 14, y - 44); ctx.lineTo(x + 4, y - 54); ctx.lineTo(x - 4, y - 54); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 6, y - 34, 12, 2);
  Gfx.glow(ctx, x, y - 39, 22, '#ffffff', 0.35 * fl);
}

function drawShrine(ctx, s, pal, time) {
  const x = s.x, y = s.y;
  if (!s.used) Gfx.glow(ctx, x, y - 30, 120, '#ffe8a8', 0.42 + Math.sin(time * 3) * 0.12);
  ctx.fillStyle = '#1a1310';
  ctx.fillRect(x - 24, y - 8, 48, 8); ctx.fillRect(x - 20, y - 12, 40, 4);
  ctx.fillStyle = '#6a2f20'; ctx.fillRect(x - 16, y - 42, 32, 30);
  ctx.fillStyle = '#4a1f15'; ctx.fillRect(x - 16, y - 42, 5, 30); ctx.fillRect(x + 11, y - 42, 5, 30);
  ctx.fillStyle = s.used ? '#2a1a14' : '#ffe8a8'; ctx.fillRect(x - 8, y - 34, 16, 20);
  if (!s.used) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 30, 6, 10); }
  ctx.fillStyle = '#1a1310';
  ctx.fillRect(x - 0.7, y - 34, 1.4, 20); ctx.fillRect(x - 8, y - 25, 16, 1.4);
  ctx.beginPath(); ctx.moveTo(x - 30, y - 40); ctx.quadraticCurveTo(x, y - 50, x + 30, y - 40); ctx.lineTo(x + 18, y - 60); ctx.lineTo(x - 18, y - 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(x - 18, y - 62, 36, 3);
  ctx.strokeStyle = '#e8dcb0'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - 17, y - 42); ctx.quadraticCurveTo(x, y - 36, x + 17, y - 42); ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = -1; i <= 1; i++) { ctx.fillRect(x + i * 9 - 1.5, y - 40, 3, 6); }
}

function drawSign(ctx, s) {
  ctx.fillStyle = '#20150f'; ctx.fillRect(s.x - 2.5, s.y - 36, 5, 36);
  ctx.fillStyle = '#8a6844'; ctx.fillRect(s.x - 16, s.y - 48, 32, 19);
  ctx.fillStyle = '#b08a5c'; ctx.fillRect(s.x - 16, s.y - 48, 32, 3);
  ctx.fillStyle = '#4a3422'; ctx.fillRect(s.x - 16, s.y - 31, 32, 2);
  ctx.fillStyle = '#2a1c14'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('!', s.x, s.y - 34);
}

// the gate at the end of a road: walk through it to finish the chapter
function drawGoal(ctx, gl, pal, time) {
  const x = gl.x, y = gl.y, h = 150, w = 120;
  Gfx.glow(ctx, x, y - 70, 170, pal.lamp, 0.4 + Math.sin(time * 2) * 0.1);
  ctx.fillStyle = '#c3262f';
  ctx.fillRect(x - w * 0.42, y - h, 11, h); ctx.fillRect(x + w * 0.42 - 11, y - h, 11, h);
  ctx.fillRect(x - w * 0.56, y - h * 0.8, w * 1.12, 8);
  ctx.fillStyle = '#e04a50'; ctx.fillRect(x - w * 0.42, y - h, 3, h); ctx.fillRect(x + w * 0.42 - 11, y - h, 3, h);
  ctx.fillStyle = '#15100f';
  ctx.beginPath(); ctx.moveTo(x - w * 0.72, y - h * 1.04); ctx.quadraticCurveTo(x, y - h * 0.95, x + w * 0.72, y - h * 1.04);
  ctx.lineTo(x + w * 0.64, y - h * 0.92); ctx.quadraticCurveTo(x, y - h * 0.86, x - w * 0.64, y - h * 0.92); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - w * 0.42 - 3, y - 7, 17, 7); ctx.fillRect(x + w * 0.42 - 14, y - 7, 17, 7);
  ctx.fillStyle = '#ffe8a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 16px "Shippori Mincho B1", serif'; ctx.fillText('進', x, y - h * 0.87 + 14);
}

// ---------- parallax backgrounds ----------
const BGW = 2048, BGH = 720;
const Shapes = {
  mountains(g, R, base, minH, maxH, step, col) {
    g.fillStyle = col;
    const pts = [];
    for (let x = 0; x < BGW; x += step * (0.6 + R() * 0.8)) pts.push([x, base - minH - R() * (maxH - minH)]);
    pts.push([BGW, pts[0][1]]);
    g.beginPath(); g.moveTo(0, BGH);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(BGW, BGH); g.closePath(); g.fill();
  },
  // rounded, rolling hills
  hills(g, R, base, amp, step, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, BGH);
    let x = 0, y = base - R() * amp; const y0 = y;
    g.lineTo(0, y);
    while (x < BGW) {
      const nx = Math.min(BGW, x + step * (0.7 + R() * 0.7)), ny = nx >= BGW ? y0 : base - R() * amp;
      g.bezierCurveTo(x + (nx - x) * 0.5, y, x + (nx - x) * 0.5, ny, nx, ny);
      x = nx; y = ny;
    }
    g.lineTo(BGW, BGH); g.closePath(); g.fill();
  },
  // sharp snow-capped peak
  peak(g, R, x, base, w, h, col, cap) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - w, base + 300); g.lineTo(x - w * 0.12, base - h); g.lineTo(x + w * 0.1, base - h * 0.96); g.lineTo(x + w, base + 300); g.closePath(); g.fill();
    if (cap) {
      g.fillStyle = cap;
      g.beginPath(); g.moveTo(x - w * 0.12, base - h); g.lineTo(x + w * 0.1, base - h * 0.96); g.lineTo(x + w * 0.3, base - h * 0.7);
      g.lineTo(x + w * 0.12, base - h * 0.76); g.lineTo(x, base - h * 0.66); g.lineTo(x - w * 0.14, base - h * 0.78); g.lineTo(x - w * 0.32, base - h * 0.68); g.closePath(); g.fill();
    }
  },
  monolith(g, R, x, base, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x, base - h, w, h + 400);
    g.fillRect(x - w * 0.12, base - h - 14, w * 1.24, 16);
    if (R() < 0.6) { const s = 10 + R() * 26; g.fillRect(x + w * (0.1 + R() * 0.6), base - h - 50 - R() * 80, s, s); }
    if (R() < 0.4) { const s = 6 + R() * 14; g.fillRect(x + w * R(), base - h - 120 - R() * 60, s, s); }
  },
  pillar(g, R, x, base, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x, base - h, w, h + 400);
    g.fillRect(x - 7, base - h - 10, w + 14, 12);
    if (R() < 0.5) { g.beginPath(); g.moveTo(x, base - h - 10); g.lineTo(x + w * 0.35, base - h - 26 - R() * 34); g.lineTo(x + w, base - h - 10); g.closePath(); g.fill(); }
    g.strokeStyle = col; g.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const vx = x - 6 + R() * (w + 12), l = 40 + R() * 160;
      g.beginPath(); g.moveTo(vx, base - h); g.quadraticCurveTo(vx + 10, base - h + l * 0.5, vx - 3, base - h + l); g.stroke();
    }
  },
  pine(g, R, x, base, h, col) {
    g.fillStyle = col;
    g.fillRect(x - 3, base - h * 0.3, 6, h * 0.3 + 300);
    for (let i = 0; i < 4; i++) {
      const w = h * (0.42 - i * 0.08), y = base - h * 0.2 - i * h * 0.2;
      g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.lineTo(x, y - h * 0.32); g.closePath(); g.fill();
    }
  },
  tree(g, R, x, base, h, col, blobCol) {
    g.strokeStyle = col; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, base + 300); g.lineTo(x, base); g.quadraticCurveTo(x + 10, base - h * 0.5, x + (R() - 0.5) * 40, base - h * 0.8); g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x, base - h * (0.4 + i * 0.15)); g.lineTo(x + (R() - 0.5) * h * 0.8, base - h * (0.6 + i * 0.12)); g.stroke(); }
    if (blobCol) {
      g.fillStyle = blobCol;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + (R() - 0.5) * h * 0.8, base - h * (0.65 + R() * 0.3), 14 + R() * 22, 0, TAU); g.fill(); }
    }
  },
  bamboo(g, R, x, base, h, w, col) {
    const lean = (R() - 0.5) * 50;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x, base + 300); g.lineTo(x, base); g.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, x + lean, base - h); g.stroke();
    g.fillStyle = col;
    for (let j = 0; j < 9; j++) {
      const t = 0.5 + R() * 0.5, px = x + lean * t * t, py = base - h * t, a = (R() - 0.5) * 2.4, l = w * 3 + R() * w * 3;
      g.save(); g.translate(px, py); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -w * 0.7, l, w * 0.3); g.quadraticCurveTo(l * 0.5, w * 0.5, 0, 0); g.fill();
      g.restore();
    }
  },
  // thatched farmhouse; burnt = roof beams only
  house(g, R, x, base, w, col, burnt) {
    g.fillStyle = col;
    const h = w * 0.42;
    g.fillRect(x - w * 0.42, base - h, w * 0.84, h + 300);
    if (burnt) {
      g.strokeStyle = col; g.lineWidth = Math.max(3, w * 0.03);
      for (let i = 0; i < 5; i++) { const t = -0.5 + i * 0.25; g.beginPath(); g.moveTo(x + t * w, base - h); g.lineTo(x + t * w * 0.4, base - h - w * (0.2 + R() * 0.2)); g.stroke(); }
    } else {
      g.beginPath(); g.moveTo(x - w * 0.6, base - h + 4); g.quadraticCurveTo(x - w * 0.2, base - h - w * 0.2, x - w * 0.08, base - h - w * 0.42);
      g.lineTo(x + w * 0.08, base - h - w * 0.42); g.quadraticCurveTo(x + w * 0.2, base - h - w * 0.2, x + w * 0.6, base - h + 4); g.closePath(); g.fill();
    }
  },
  smoke(g, R, x, base, h, col) {
    for (let i = 0; i < 14; i++) {
      const t = i / 14, rr = 14 + t * 60;
      g.fillStyle = col;
      g.beginPath(); g.arc(x + t * t * 220 + (R() - 0.5) * 24, base - t * h, rr * (t > 0.75 ? (1 - t) * 4 : 1), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  },
  torii(g, x, base, h, col) {
    g.fillStyle = col;
    const w = h * 0.9;
    g.fillRect(x - w * 0.38, base - h, h * 0.07, h + 300);
    g.fillRect(x + w * 0.38 - h * 0.07, base - h, h * 0.07, h + 300);
    g.fillRect(x - w * 0.48, base - h * 0.78, w * 0.96, h * 0.06);
    g.beginPath();
    g.moveTo(x - w * 0.62, base - h * 1.02); g.quadraticCurveTo(x, base - h * 0.92, x + w * 0.62, base - h * 1.02);
    g.lineTo(x + w * 0.55, base - h * 0.9); g.quadraticCurveTo(x, base - h * 0.84, x - w * 0.55, base - h * 0.9); g.closePath(); g.fill();
  },
  pagoda(g, x, base, w, tiers, col) {
    g.fillStyle = col;
    let y = base;
    for (let i = 0; i < tiers; i++) {
      const tw = w * (1 - i * 0.13), th = w * 0.42;
      g.fillRect(x - tw * 0.32, y - th, tw * 0.64, th);
      g.beginPath();
      g.moveTo(x - tw * 0.62, y - th + 4); g.quadraticCurveTo(x - tw * 0.3, y - th - 2, x - tw * 0.2, y - th - 14);
      g.lineTo(x + tw * 0.2, y - th - 14); g.quadraticCurveTo(x + tw * 0.3, y - th - 2, x + tw * 0.62, y - th + 4); g.closePath(); g.fill();
      y -= th + 10;
    }
    g.fillRect(x - 2, y - 40, 4, 44);
  },
  castle(g, x, base, s, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - 200 * s, base + 200); g.lineTo(x - 150 * s, base - 90 * s); g.lineTo(x + 150 * s, base - 90 * s); g.lineTo(x + 200 * s, base + 200); g.closePath(); g.fill();
    Shapes.pagoda(g, x, base - 90 * s, 260 * s, 4, col);
  },
  // long curtain wall with crenellations and corner towers
  rampart(g, R, base, h, col) {
    g.fillStyle = col;
    g.fillRect(0, base - h, BGW, h + 300);
    for (let x = 0; x < BGW; x += 46) g.fillRect(x, base - h - 12, 30, 14);
    for (let x = 180; x < BGW; x += 620) {
      g.beginPath(); g.moveTo(x - 70, base + 200); g.lineTo(x - 52, base - h - 40); g.lineTo(x + 52, base - h - 40); g.lineTo(x + 70, base + 200); g.closePath(); g.fill();
      Shapes.pagoda(g, x, base - h - 40, 150, 2, col);
    }
  },
  flag(g, x, base, h, col) {
    g.fillStyle = col; g.fillRect(x, base - h, 4, h + 200); g.fillRect(x + 4, base - h + 6, 30, h * 0.5);
  },
  cloud(g, R, x, y, w, col) {
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * w, y + (R() - 0.5) * w * 0.12, w * (0.2 + R() * 0.25), w * 0.07, 0, 0, TAU); g.fill(); }
  },
  // small warm lights (windows, lanterns): painted after the fog so they stay bright
  lights(g, R, n, y0, y1, col, r = 2.2) {
    for (let i = 0; i < n; i++) {
      const x = R() * BGW, y = y0 + R() * (y1 - y0);
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 7);
      gr.addColorStop(0, hexA(col, 0.55)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  },
};

// make(parallax factor, seed, fog amount, painter, optional lights painter)
const BG_THEMES = {
  road(make, pal) {
    make(0.05, 61, 0.55, (g, R) => Shapes.mountains(g, R, 600, 90, 250, 150, mixHex(pal.far, pal.skyMid, 0.5)));
    make(0.12, 62, 0.5, (g, R) => Shapes.hills(g, R, 600, 110, 260, pal.far));
    make(0.24, 63, 0.45, (g, R) => {
      Shapes.hills(g, R, 660, 50, 320, pal.mid);
      for (let i = 0; i < 7; i++) { const x = 120 + i * 280 + R() * 90; Shapes.house(g, R, x, 640 + R() * 20, 120 + R() * 60, pal.mid, R() < 0.6); }
      for (let i = 0; i < 4; i++) Shapes.smoke(g, R, 200 + i * 520 + R() * 80, 600, 380, pal.mid);
    }, (g, R) => Shapes.lights(g, R, 26, 600, 660, '#ff8a3a', 2.4));
    make(0.42, 64, 0.35, (g, R) => {
      for (let i = 0; i < 10; i++) Shapes.tree(g, R, R() * BGW, 700, 160 + R() * 150, pal.near, null);
      for (let i = 0; i < 3; i++) Shapes.house(g, R, 300 + i * 700 + R() * 100, 700, 220, pal.near, true);
    }, (g, R) => Shapes.lights(g, R, 14, 640, 700, '#ffb060', 3));
  },
  ruins(make, pal) {
    make(0.05, 11, 0.5, (g, R) => Shapes.mountains(g, R, 600, 80, 220, 140, mixHex(pal.far, pal.skyBot, 0.45)));
    make(0.12, 14, 0.55, (g, R) => { for (let i = 0; i < 9; i++) Shapes.monolith(g, R, R() * BGW, 620, 90 + R() * 160, 260 + R() * 300, mixHex(pal.far, pal.skyBot, 0.2)); });
    make(0.22, 12, 0.5, (g, R) => { for (let i = 0; i < 13; i++) Shapes.monolith(g, R, R() * BGW, 650, 60 + R() * 140, 200 + R() * 330, pal.far); });
    make(0.42, 13, 0.35, (g, R) => { for (let i = 0; i < 8; i++) Shapes.pillar(g, R, R() * BGW, 700, 40 + R() * 50, 300 + R() * 260, pal.mid); });
  },
  foothills(make, pal) {
    make(0.05, 71, 0.45, (g, R) => {
      Shapes.mountains(g, R, 620, 120, 300, 110, mixHex(pal.far, pal.skyMid, 0.5));
      g.fillStyle = mixHex(pal.far, pal.skyMid, 0.35);
      g.beginPath(); g.moveTo(1100, 720); g.lineTo(1420, 170); g.lineTo(1520, 170); g.lineTo(1880, 720); g.closePath(); g.fill();
    }, (g) => {
      const gr = g.createRadialGradient(1470, 170, 4, 1470, 170, 190);
      gr.addColorStop(0, 'rgba(255,200,110,0.9)'); gr.addColorStop(0.3, 'rgba(255,120,50,0.45)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = gr; g.fillRect(1260, -30, 420, 400);
      g.strokeStyle = 'rgba(255,150,60,0.8)'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(1465, 176); g.quadraticCurveTo(1440, 330, 1380, 470); g.stroke();
      g.beginPath(); g.moveTo(1480, 176); g.quadraticCurveTo(1530, 300, 1600, 430); g.stroke();
    });
    make(0.14, 72, 0.5, (g, R) => Shapes.mountains(g, R, 660, 60, 260, 60, pal.far));
    make(0.26, 73, 0.45, (g, R) => { Shapes.mountains(g, R, 700, 30, 200, 44, pal.mid); }, (g, R) => Shapes.lights(g, R, 18, 560, 700, '#ff7a30', 2));
    make(0.44, 74, 0.3, (g, R) => { for (let i = 0; i < 12; i++) Shapes.tree(g, R, R() * BGW, 710, 130 + R() * 150, pal.near, null); });
  },
  ember(make, pal) {
    make(0.05, 21, 0.4, (g, R) => {
      Shapes.mountains(g, R, 620, 100, 260, 120, mixHex(pal.far, pal.skyMid, 0.4));
      g.fillStyle = mixHex(pal.far, pal.skyMid, 0.25);
      g.beginPath(); g.moveTo(900, 720); g.lineTo(1180, 230); g.lineTo(1260, 230); g.lineTo(1560, 720); g.closePath(); g.fill();
    }, (g) => {
      const gr = g.createRadialGradient(1220, 230, 4, 1220, 230, 150);
      gr.addColorStop(0, 'rgba(255,200,100,0.85)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = gr; g.fillRect(1060, 80, 320, 300);
    });
    make(0.13, 24, 0.5, (g, R) => Shapes.mountains(g, R, 660, 80, 280, 90, mixHex(pal.far, pal.skyMid, 0.15)));
    make(0.22, 22, 0.5, (g, R) => Shapes.mountains(g, R, 690, 60, 280, 70, pal.far));
    make(0.42, 23, 0.4, (g, R) => {
      for (let i = 0; i < 9; i++) Shapes.tree(g, R, R() * BGW, 700, 150 + R() * 140, pal.mid, null);
      Shapes.torii(g, 700, 700, 220, pal.mid); Shapes.torii(g, 1700, 700, 170, pal.mid);
    }, (g, R) => Shapes.lights(g, R, 10, 620, 700, '#ffb050', 2.4));
  },
  steps(make, pal) {
    const cap = mixHex(pal.grass, pal.skyBot, 0.25);
    make(0.04, 81, 0.5, (g, R) => { for (let i = 0; i < 6; i++) Shapes.peak(g, R, 150 + i * 350 + R() * 120, 640, 200 + R() * 120, 330 + R() * 220, mixHex(pal.far, pal.skyMid, 0.5), cap); });
    make(0.1, 82, 0.5, (g, R) => {
      for (let i = 0; i < 7; i++) Shapes.peak(g, R, R() * BGW, 680, 150 + R() * 110, 260 + R() * 200, pal.far, cap);
      for (let i = 0; i < 5; i++) Shapes.cloud(g, R, R() * BGW, 330 + R() * 200, 300 + R() * 200, 'rgba(255,240,235,0.4)');
    });
    make(0.22, 83, 0.45, (g, R) => {
      Shapes.hills(g, R, 690, 90, 300, pal.mid);
      for (let i = 0; i < 4; i++) Shapes.torii(g, 200 + i * 520 + R() * 60, 640 + R() * 20, 120 + R() * 40, pal.mid);
      for (let i = 0; i < 12; i++) Shapes.pine(g, R, R() * BGW, 630 + R() * 60, 70 + R() * 50, pal.mid);
    });
    make(0.42, 84, 0.3, (g, R) => { for (let i = 0; i < 13; i++) Shapes.pine(g, R, R() * BGW, 705, 130 + R() * 150, pal.near); });
  },
  peaks(make, pal) {
    const cap = mixHex(pal.grass, pal.skyBot, 0.2);
    make(0.05, 31, 0.6, (g, R) => {
      for (let i = 0; i < 9; i++) Shapes.peak(g, R, R() * BGW, 700, 70 + R() * 130, 300 + R() * 300, mixHex(pal.far, pal.skyBot, 0.5), cap);
      for (let i = 0; i < 6; i++) Shapes.cloud(g, R, R() * BGW, 250 + R() * 250, 300 + R() * 200, 'rgba(255,255,255,0.35)');
    });
    make(0.12, 34, 0.5, (g, R) => { for (let i = 0; i < 7; i++) Shapes.peak(g, R, R() * BGW, 720, 130 + R() * 120, 240 + R() * 220, mixHex(pal.far, pal.skyBot, 0.2), cap); });
    make(0.22, 32, 0.5, (g, R) => {
      Shapes.mountains(g, R, 690, 80, 280, 90, pal.far);
      for (let i = 0; i < 14; i++) Shapes.pine(g, R, R() * BGW, 560 + R() * 80, 60 + R() * 50, pal.far);
    });
    make(0.42, 33, 0.35, (g, R) => { for (let i = 0; i < 14; i++) Shapes.pine(g, R, R() * BGW, 700, 120 + R() * 140, pal.mid); });
  },
  woods(make, pal) {
    make(0.05, 91, 0.6, (g, R) => Shapes.hills(g, R, 560, 160, 300, mixHex(pal.far, pal.skyBot, 0.45)));
    make(0.12, 92, 0.6, (g, R) => { for (let i = 0; i < 46; i++) Shapes.bamboo(g, R, R() * BGW, 700, 420 + R() * 260, 5 + R() * 3, mixHex(pal.far, pal.skyBot, 0.2)); });
    make(0.24, 93, 0.5, (g, R) => { for (let i = 0; i < 34; i++) Shapes.bamboo(g, R, R() * BGW, 710, 460 + R() * 240, 8 + R() * 5, pal.mid); },
      (g, R) => Shapes.lights(g, R, 16, 380, 620, pal.lamp, 3.2));
    make(0.44, 94, 0.3, (g, R) => { for (let i = 0; i < 20; i++) Shapes.bamboo(g, R, R() * BGW, 720, 520 + R() * 200, 14 + R() * 8, pal.near); },
      (g, R) => Shapes.lights(g, R, 9, 330, 560, pal.lamp, 4.5));
  },
  shrine(make, pal) {
    make(0.05, 41, 0.5, (g, R) => Shapes.mountains(g, R, 640, 90, 240, 130, mixHex(pal.far, pal.skyBot, 0.4)));
    make(0.12, 44, 0.5, (g, R) => Shapes.hills(g, R, 640, 120, 280, mixHex(pal.far, pal.skyBot, 0.15)));
    make(0.22, 42, 0.5, (g, R) => {
      Shapes.pagoda(g, 500, 640, 190, 5, pal.far); Shapes.pagoda(g, 1500, 650, 140, 3, pal.far);
      for (let i = 0; i < 8; i++) Shapes.tree(g, R, R() * BGW, 660, 120 + R() * 90, pal.far, pal.far);
    }, (g, R) => Shapes.lights(g, R, 14, 470, 640, pal.lamp, 2.2));
    make(0.42, 43, 0.35, (g, R) => {
      for (let i = 0; i < 5; i++) Shapes.torii(g, 150 + i * 410 + R() * 60, 700, 200 + R() * 60, pal.mid);
      for (let i = 0; i < 6; i++) Shapes.tree(g, R, R() * BGW, 700, 170 + R() * 100, pal.mid, mixHex(pal.mid, pal.grass, 0.28));
    });
  },
  wall(make, pal) {
    make(0.05, 101, 0.5, (g, R) => Shapes.mountains(g, R, 620, 100, 260, 130, mixHex(pal.far, pal.skyBot, 0.5)));
    make(0.12, 102, 0.5, (g, R) => { Shapes.castle(g, 1300, 610, 1.25, mixHex(pal.far, pal.skyBot, 0.2)); Shapes.hills(g, R, 660, 60, 300, mixHex(pal.far, pal.skyBot, 0.2)); },
      (g, R) => Shapes.lights(g, R, 12, 250, 520, '#ffb060', 1.8));
    make(0.24, 103, 0.45, (g, R) => Shapes.rampart(g, R, 660, 150, pal.mid), (g, R) => Shapes.lights(g, R, 20, 470, 500, '#ffa050', 2.6));
    make(0.44, 104, 0.3, (g, R) => {
      g.fillStyle = pal.near; g.fillRect(0, 640, BGW, 200);
      for (let x = 0; x < BGW; x += 46) g.fillRect(x, 628, 30, 14);
      for (let i = 0; i < 8; i++) Shapes.flag(g, R() * BGW, 640, 260 + R() * 60, pal.near);
    });
  },
  castle(make, pal) {
    make(0.05, 51, 0.45, (g, R) => Shapes.mountains(g, R, 640, 100, 260, 120, mixHex(pal.far, pal.skyBot, 0.35)));
    make(0.12, 54, 0.5, (g, R) => Shapes.rampart(g, R, 640, 90, mixHex(pal.far, pal.skyBot, 0.12)), (g, R) => Shapes.lights(g, R, 16, 520, 545, '#ff9050', 1.8));
    make(0.22, 52, 0.5, (g, R) => {
      Shapes.castle(g, 1000, 620, 1.1, pal.far);
      for (let i = 0; i < 10; i++) Shapes.pine(g, R, R() * BGW, 650, 70 + R() * 60, pal.far);
    }, (g, R) => Shapes.lights(g, R, 18, 300, 560, '#ffb060', 2));
    make(0.42, 53, 0.35, (g, R) => {
      g.fillStyle = pal.mid; g.fillRect(0, 600, BGW, 200);
      for (let x = 0; x < BGW; x += 46) g.fillRect(x, 588, 30, 14);
      for (let i = 0; i < 7; i++) Shapes.flag(g, R() * BGW, 610, 280, pal.mid);
    });
  },
};

function buildBackground(pal, theme) {
  const layers = [];
  const make = (factor, seed, fogA, painter, lights) => {
    // paint into a triple-wide canvas, then fold the overflow back so the strip tiles seamlessly
    const c = document.createElement('canvas'); c.width = BGW * 3; c.height = BGH;
    const g = c.getContext('2d');
    g.translate(BGW, 0); painter(g, mulberry32(seed));
    const img = document.createElement('canvas'); img.width = BGW; img.height = BGH;
    const ig = img.getContext('2d');
    ig.drawImage(c, 0, 0); ig.drawImage(c, -BGW, 0); ig.drawImage(c, -2 * BGW, 0);
    // rim light: tint the whole silhouette, then lay the original back over it a few pixels down-right
    if (pal.rim) {
      const sil = document.createElement('canvas'); sil.width = BGW; sil.height = BGH;
      sil.getContext('2d').drawImage(img, 0, 0);
      ig.globalCompositeOperation = 'source-atop';
      ig.fillStyle = hexA(pal.rim, 0.5 + factor * 0.6); ig.fillRect(0, 0, BGW, BGH);
      ig.globalCompositeOperation = 'source-over';
      ig.drawImage(sil, 1.5, 3);
    }
    if (fogA > 0) {
      ig.globalCompositeOperation = 'source-atop';
      const gr = ig.createLinearGradient(0, BGH * 0.3, 0, BGH);
      gr.addColorStop(0, hexA(pal.fog, 0)); gr.addColorStop(1, hexA(pal.fog, fogA));
      ig.fillStyle = gr; ig.fillRect(0, 0, BGW, BGH);
      ig.globalCompositeOperation = 'source-over';
    }
    if (lights) {
      const R = mulberry32(seed + 1000);
      for (const off of [0, -BGW, BGW]) { ig.save(); ig.translate(off, 0); lights(ig, mulberry32(seed + 1000)); ig.restore(); }
      void R;
    }
    layers.push({ c: img, factor });
  };
  (BG_THEMES[theme] || BG_THEMES.ruins)(make, pal);
  return layers;
}
