'use strict';
// ---------- palettes ----------
const PALS = {
  ruins: { skyTop: '#06242b', skyBot: '#46b8b0', moon: '#effff8', glow: '190,255,235', far: '#2b8f8e', mid: '#1b6a70', near: '#0f4a52', fog: '#6ad8c8', rock: '#2b4d5a', rockDark: '#172f3a', rockLight: '#4b7a86', grass: '#cfd64b', grassDark: '#86a12c', particle: '#c8fff0', pkind: 'mote', fg: '#041a20', lamp: '#ffe9a8' },
  ember: { skyTop: '#1a0709', skyBot: '#d4583a', moon: '#ffd9a0', glow: '255,170,110', far: '#8a3328', mid: '#561d1d', near: '#3a1214', fog: '#ff8a5a', rock: '#3c2a2c', rockDark: '#211618', rockLight: '#634346', grass: '#e9a43c', grassDark: '#9c5a22', particle: '#ffb35c', pkind: 'ember', fg: '#140506', lamp: '#ffb070' },
  peaks: { skyTop: '#132a4a', skyBot: '#a9d8e0', moon: '#ffffff', glow: '220,240,255', far: '#7c9fc0', mid: '#4d6c92', near: '#2f4766', fog: '#d2ecf5', rock: '#3a4a66', rockDark: '#222d42', rockLight: '#5f7393', grass: '#eef4ff', grassDark: '#a9bfd9', particle: '#ffffff', pkind: 'snow', fg: '#0b1424', lamp: '#e9f4ff' },
  shrine: { skyTop: '#0f0824', skyBot: '#7a46a8', moon: '#fff0ff', glow: '255,200,255', far: '#5a3488', mid: '#36205e', near: '#22143f', fog: '#c08ae0', rock: '#2d2444', rockDark: '#18122b', rockLight: '#4a3c6e', grass: '#f08cc4', grassDark: '#a2457e', particle: '#ffc2e2', pkind: 'petal', fg: '#0a0616', lamp: '#8fe3ff' },
  castle: { skyTop: '#140304', skyBot: '#8e1d1d', moon: '#ff5a4e', glow: '255,90,70', far: '#5a1414', mid: '#360b0c', near: '#220607', fog: '#c2402e', rock: '#2c2325', rockDark: '#150f10', rockLight: '#4a3c3e', grass: '#cfa86a', grassDark: '#7d5a30', particle: '#ff9878', pkind: 'ash', fg: '#0a0202', lamp: '#ff8a5a' },
};

const CHUNK = 16;
// tile codes: 0 empty, 1 solid, 2 one-way, 3..6 spikes (up, down, right, left)

class Level {
  constructor(cols, rows, pal) {
    this.cols = cols; this.rows = rows; this.pal = pal;
    this.tiles = new Uint8Array(cols * rows);
    this.width = cols * T; this.height = rows * T;
    this.chunks = new Map();
    this.spawns = []; this.signs = []; this.shrines = []; this.lanterns = []; this.spawnPts = [];
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
  chunk(ci) {
    let c = this.chunks.get(ci);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = CHUNK * T; c.height = this.rows * T;
    const g = c.getContext('2d');
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
    this.arenaDef = null; this.startCol = 3;
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
  wall() { return this.ground(2, 0); }
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
    return L;
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
    // low-poly facets
    g.globalAlpha = 0.16 + h2 * 0.22;
    g.fillStyle = h < 0.5 ? pal.rockLight : pal.rockDark;
    g.beginPath();
    if (h2 < 0.5) { g.moveTo(x, y); g.lineTo(x + T, y); g.lineTo(x + h3 * T * 0.6, y + T); }
    else { g.moveTo(x + T, y); g.lineTo(x + T, y + T); g.lineTo(x + h3 * T * 0.4, y + T * 0.3); }
    g.closePath(); g.fill();
    // depth darkening
    let depth = 0;
    for (let k = 1; k <= 5; k++) { if (r - k >= 0 && L.get(c, r - k) === 1) depth++; else break; }
    if (depth) { g.globalAlpha = Math.min(0.45, depth * 0.08); g.fillStyle = '#000'; g.fillRect(x, y, T, T); }
    g.globalAlpha = 1;
    if (h > 0.84) {
      g.strokeStyle = pal.rockDark; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + h2 * T, y + 8); g.lineTo(x + h3 * T, y + T * 0.55); g.lineTo(x + h2 * T * 0.6 + 6, y + T - 4); g.stroke();
    }
    if (open(L.get(c - 1, r)) && c > 0) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y, 5, T);
      g.globalAlpha = 0.4; g.fillStyle = pal.rockLight; g.fillRect(x, y, 2, T); g.globalAlpha = 1;
    }
    if (open(L.get(c + 1, r)) && c < L.cols - 1) { g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(x + T - 6, y, 6, T); }
    if (r + 1 < L.rows && open(L.get(c, r + 1))) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + T - 6, T, 6);
      g.strokeStyle = pal.grassDark; g.lineWidth = 1.2;
      for (let k = 0; k < 2; k++) {
        if (hash2(c * 3 + k, r * 5) < 0.55) continue;
        const vx = x + hash2(c + k, r) * T, len = 10 + hash2(c, r + k) * 30;
        g.beginPath(); g.moveTo(vx, y + T); g.quadraticCurveTo(vx + 4, y + T + len * 0.5, vx - 2, y + T + len); g.stroke();
      }
    }
    if (top) {
      g.fillStyle = pal.grassDark; g.fillRect(x, y, T, 10);
      g.fillStyle = pal.grass; g.fillRect(x, y, T, 6);
      for (let k = 0; k < 7; k++) {
        const hh = hash2(c * 13 + k, r * 7 + k);
        const bx = x + hh * T, bh = 3 + hash2(c + k * 5, r) * 8;
        g.beginPath(); g.moveTo(bx - 2.5, y + 2); g.lineTo(bx + 2.5, y + 2); g.lineTo(bx + (hh - 0.5) * 5, y - bh); g.closePath(); g.fill();
      }
      if (open(L.get(c - 1, r))) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.lineTo(x - 2, y + 14); g.closePath(); g.fill(); }
      if (open(L.get(c + 1, r))) { g.beginPath(); g.moveTo(x + T, y); g.lineTo(x + T - 6, y + 8); g.lineTo(x + T + 2, y + 14); g.closePath(); g.fill(); }
    }
  } else if (t === 2) {
    g.fillStyle = pal.rockDark; g.fillRect(x, y + 3, T, 14);
    g.fillStyle = pal.rockLight; g.fillRect(x, y + 3, T, 4);
    g.fillStyle = pal.grass; g.fillRect(x, y, T, 5);
    for (let k = 0; k < 4; k++) {
      const bx = x + hash2(c * 5 + k, r) * T, bh = 2 + hash2(c, r + k) * 6;
      g.beginPath(); g.moveTo(bx - 2, y + 1); g.lineTo(bx + 2, y + 1); g.lineTo(bx, y - bh); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 15, T, 3);
    if (L.get(c - 1, r) !== 2) { g.fillStyle = pal.rockDark; g.fillRect(x + 4, y + 17, 5, 8); }
    if (L.get(c + 1, r) !== 2) { g.fillStyle = pal.rockDark; g.fillRect(x + T - 9, y + 17, 5, 8); }
  } else if (t >= 3) {
    g.save();
    g.translate(x + T / 2, y + T / 2);
    g.rotate({ 3: 0, 4: Math.PI, 5: Math.PI / 2, 6: -Math.PI / 2 }[t]);
    g.fillStyle = '#1b2026'; g.fillRect(-T / 2, T / 2 - 6, T, 6);
    for (let i = 0; i < 4; i++) {
      const bx = -T / 2 + 5 + i * 10;
      g.fillStyle = '#b8c3cc';
      g.beginPath(); g.moveTo(bx - 5, T / 2 - 5); g.lineTo(bx + 5, T / 2 - 5); g.lineTo(bx, -T / 2 + 8); g.closePath(); g.fill();
      g.fillStyle = '#6d7984';
      g.beginPath(); g.moveTo(bx, T / 2 - 5); g.lineTo(bx + 5, T / 2 - 5); g.lineTo(bx, -T / 2 + 8); g.closePath(); g.fill();
    }
    g.restore();
  }
}

// ---------- world props (lanterns, shrines, signs) ----------
function drawLantern(ctx, l, pal, time) {
  const x = l.x, y = l.y;
  const fl = 0.85 + Math.sin(time * 7 + l.ph) * 0.08 + Math.sin(time * 13 + l.ph) * 0.05;
  const gr = ctx.createRadialGradient(x, y - 38, 2, x, y - 38, 70);
  gr.addColorStop(0, hexA(pal.lamp, 0.45 * fl)); gr.addColorStop(1, hexA(pal.lamp, 0));
  ctx.fillStyle = gr; ctx.fillRect(x - 70, y - 108, 140, 140);
  ctx.fillStyle = '#10161a';
  ctx.fillRect(x - 9, y - 6, 18, 6);
  ctx.fillRect(x - 3, y - 30, 6, 24);
  ctx.fillRect(x - 8, y - 32, 16, 3);
  ctx.fillStyle = pal.lamp; ctx.globalAlpha = fl;
  ctx.fillRect(x - 6, y - 45, 12, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#10161a';
  ctx.beginPath(); ctx.moveTo(x - 13, y - 44); ctx.lineTo(x + 13, y - 44); ctx.lineTo(x + 4, y - 53); ctx.lineTo(x - 4, y - 53); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 6, y - 34, 12, 2);
}

function drawShrine(ctx, s, pal, time) {
  const x = s.x, y = s.y;
  if (!s.used) {
    const a = 0.35 + Math.sin(time * 3) * 0.12;
    const gr = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 90);
    gr.addColorStop(0, `rgba(255,240,190,${a})`); gr.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 90, y - 120, 180, 180);
  }
  ctx.fillStyle = '#1a1310';
  ctx.fillRect(x - 22, y - 8, 44, 8);
  ctx.fillStyle = '#5a2a1e'; ctx.fillRect(x - 16, y - 40, 32, 32);
  ctx.fillStyle = s.used ? '#2a1a14' : '#ffe8a8'; ctx.fillRect(x - 8, y - 32, 16, 18);
  ctx.fillStyle = '#1a1310';
  ctx.beginPath(); ctx.moveTo(x - 28, y - 38); ctx.quadraticCurveTo(x, y - 48, x + 28, y - 38); ctx.lineTo(x + 18, y - 58); ctx.lineTo(x - 18, y - 58); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8dcb0'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - 17, y - 40); ctx.quadraticCurveTo(x, y - 34, x + 17, y - 40); ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = -1; i <= 1; i++) { ctx.fillRect(x + i * 9 - 1.5, y - 38, 3, 6); }
}

function drawSign(ctx, s) {
  ctx.fillStyle = '#2a1c14'; ctx.fillRect(s.x - 2, s.y - 34, 4, 34);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(s.x - 14, s.y - 44, 28, 16);
  ctx.fillStyle = '#4a3422'; ctx.fillRect(s.x - 14, s.y - 30, 28, 2);
  ctx.fillStyle = '#e8d8b8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', s.x, s.y - 32);
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
  cloud(g, R, x, y, w, col) {
    g.fillStyle = col;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * w, y + (R() - 0.5) * w * 0.12, w * (0.2 + R() * 0.25), w * 0.07, 0, 0, TAU); g.fill(); }
  },
};

const BG_THEMES = {
  ruins(make, pal) {
    make(0.06, 11, 0.5, (g, R) => Shapes.mountains(g, R, 600, 80, 220, 140, shade(pal.far, 0.18)));
    make(0.18, 12, 0.55, (g, R) => { for (let i = 0; i < 13; i++) Shapes.monolith(g, R, R() * BGW, 640, 60 + R() * 140, 200 + R() * 330, pal.far); });
    make(0.38, 13, 0.4, (g, R) => { for (let i = 0; i < 8; i++) Shapes.pillar(g, R, R() * BGW, 700, 40 + R() * 50, 300 + R() * 260, pal.mid); });
  },
  ember(make, pal) {
    make(0.06, 21, 0.4, (g, R) => {
      Shapes.mountains(g, R, 620, 100, 260, 120, shade(pal.far, 0.12));
      g.fillStyle = shade(pal.far, 0.05);
      g.beginPath(); g.moveTo(900, 720); g.lineTo(1180, 230); g.lineTo(1260, 230); g.lineTo(1560, 720); g.closePath(); g.fill();
      const gr = g.createRadialGradient(1220, 230, 4, 1220, 230, 140);
      gr.addColorStop(0, 'rgba(255,190,90,0.8)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = gr; g.fillRect(1060, 90, 320, 300);
    });
    make(0.2, 22, 0.5, (g, R) => Shapes.mountains(g, R, 680, 60, 300, 70, pal.far));
    make(0.4, 23, 0.4, (g, R) => {
      for (let i = 0; i < 9; i++) Shapes.tree(g, R, R() * BGW, 700, 150 + R() * 140, pal.mid, null);
      Shapes.torii(g, 700, 700, 220, pal.mid); Shapes.torii(g, 1700, 700, 170, pal.mid);
    });
  },
  peaks(make, pal) {
    make(0.06, 31, 0.6, (g, R) => {
      g.fillStyle = shade(pal.far, 0.25);
      for (let i = 0; i < 9; i++) {
        const x = R() * BGW, w = 60 + R() * 120, h = 300 + R() * 300;
        g.beginPath(); g.moveTo(x - w, 720); g.lineTo(x - w * 0.15, 700 - h); g.lineTo(x + w * 0.2, 690 - h); g.lineTo(x + w, 720); g.closePath(); g.fill();
      }
      for (let i = 0; i < 6; i++) Shapes.cloud(g, R, R() * BGW, 250 + R() * 250, 300 + R() * 200, 'rgba(255,255,255,0.35)');
    });
    make(0.2, 32, 0.5, (g, R) => {
      Shapes.mountains(g, R, 690, 80, 280, 90, pal.far);
      for (let i = 0; i < 14; i++) Shapes.pine(g, R, R() * BGW, 560 + R() * 80, 60 + R() * 50, pal.far);
    });
    make(0.4, 33, 0.35, (g, R) => { for (let i = 0; i < 14; i++) Shapes.pine(g, R, R() * BGW, 700, 120 + R() * 140, pal.mid); });
  },
  shrine(make, pal) {
    make(0.06, 41, 0.5, (g, R) => Shapes.mountains(g, R, 640, 90, 240, 130, shade(pal.far, 0.15)));
    make(0.2, 42, 0.5, (g, R) => {
      Shapes.pagoda(g, 500, 640, 190, 5, pal.far); Shapes.pagoda(g, 1500, 650, 140, 3, pal.far);
      for (let i = 0; i < 8; i++) Shapes.tree(g, R, R() * BGW, 660, 120 + R() * 90, pal.far, pal.far);
    });
    make(0.4, 43, 0.35, (g, R) => {
      for (let i = 0; i < 5; i++) Shapes.torii(g, 150 + i * 410 + R() * 60, 700, 200 + R() * 60, pal.mid);
      for (let i = 0; i < 6; i++) Shapes.tree(g, R, R() * BGW, 700, 170 + R() * 100, pal.mid, shade(pal.mid, 0.12));
    });
  },
  castle(make, pal) {
    make(0.06, 51, 0.45, (g, R) => Shapes.mountains(g, R, 640, 100, 260, 120, shade(pal.far, 0.15)));
    make(0.2, 52, 0.5, (g, R) => {
      Shapes.castle(g, 1000, 620, 1.1, pal.far);
      for (let i = 0; i < 10; i++) Shapes.pine(g, R, R() * BGW, 650, 70 + R() * 60, pal.far);
    });
    make(0.4, 53, 0.35, (g, R) => {
      g.fillStyle = pal.mid; g.fillRect(0, 600, BGW, 200);
      for (let x = 0; x < BGW; x += 46) g.fillRect(x, 588, 30, 14);
      for (let i = 0; i < 7; i++) {
        const x = R() * BGW;
        g.fillRect(x, 330, 4, 280);
        g.fillRect(x + 4, 340, 34, 150);
      }
    });
  },
};

function buildBackground(pal, theme) {
  const layers = [];
  const make = (factor, seed, fogA, painter) => {
    // paint into a triple-wide canvas, then fold the overflow back so the strip tiles seamlessly
    const c = document.createElement('canvas'); c.width = BGW * 3; c.height = BGH;
    const g = c.getContext('2d');
    const R = mulberry32(seed);
    g.translate(BGW, 0); painter(g, R);
    const img = document.createElement('canvas'); img.width = BGW; img.height = BGH;
    const ig = img.getContext('2d');
    ig.drawImage(c, 0, 0); ig.drawImage(c, -BGW, 0); ig.drawImage(c, -2 * BGW, 0);
    if (fogA > 0) {
      ig.globalCompositeOperation = 'source-atop';
      const gr = ig.createLinearGradient(0, BGH * 0.3, 0, BGH);
      gr.addColorStop(0, hexA(pal.fog, 0)); gr.addColorStop(1, hexA(pal.fog, fogA));
      ig.fillStyle = gr; ig.fillRect(0, 0, BGW, BGH);
      ig.globalCompositeOperation = 'source-over';
    }
    layers.push({ c: img, factor });
  };
  BG_THEMES[theme](make, pal);
  return layers;
}
