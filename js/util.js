'use strict';
// ---------- core constants & math ----------
const TAU = Math.PI * 2;
const STEP = 1 / 120;      // fixed physics step
const GRAV = 2000;         // px/s^2
const T = 40;              // tile size

// player preferences (persisted)
const Settings = { gore: true };
try { Settings.gore = localStorage.getItem('rr-gore') !== '0'; } catch (e) { /* storage blocked */ }

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sgn = (v) => (v < 0 ? -1 : 1);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// segment AB vs segment CD -> t along AB or -1
function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax, rY = by - ay, sX = dx - cx, sY = dy - cy;
  const den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

// segment vs axis aligned rect {x,y,w,h} (Liang-Barsky) -> entry t or -1
function segRect(ax, ay, bx, by, r) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return -1; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return -1; if (t > t0) t0 = t; }
      else { if (t < t0) return -1; if (t < t1) t1 = t; }
    }
  }
  return t0;
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segSeg(ax, ay, bx, by, cx, cy, dx, dy) >= 0) return 0;
  return Math.min(
    pointSegDist(ax, ay, cx, cy, dx, dy), pointSegDist(bx, by, cx, cy, dx, dy),
    pointSegDist(cx, cy, ax, ay, bx, by), pointSegDist(dx, dy, ax, ay, bx, by));
}

const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

// two-bone IK: returns middle joint. bend = +1/-1 picks side.
function ik2(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.01;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  if (d < 1e-4) return { x: ax, y: ay + l1 };
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  return { x: ax + ux * a - uy * h * bend, y: ay + uy * a + ux * h * bend };
}

// launch angle (screen coords) to hit (dx,dy) with speed v, gravity g. low arc.
function ballisticAngle(dx, dy, v, g) {
  const x = Math.max(1, Math.abs(dx)), y = -dy;
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * x * x + 2 * y * v2);
  const th = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * x));
  return dx >= 0 ? -th : Math.PI + th;
}

// ---------- colour helpers ----------
const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = _shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`;
  _shadeCache.set(key, v);
  return v;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- input ----------
const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  mx: 0, my: 0, ml: false, mr: false,
  down(...codes) { for (const c of codes) if (this.keys[c]) return true; return false; },
  take(...codes) {
    let r = false;
    for (const c of codes) if (this.pressed[c]) { this.pressed[c] = false; r = true; }
    return r;
  },
  clear() { this.pressed = Object.create(null); },
  init() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; // typing a name
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = Object.create(null); this.ml = this.mr = false; });
    addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
    addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.ml = true; this.pressed.Mouse0 = true; }
      if (e.button === 2) { this.mr = true; this.pressed.Mouse2 = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.ml = false;
      if (e.button === 2) this.mr = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
  },
};
