'use strict';
// ---------- character styles ----------
const STYLES = {
  player: { s: 1, head: 'human', hat: 'band', skin: '#f2cda6', hair: '#141018', gi: '#ebe5d3', arm: '#ddd6c2', hakama: '#27324d', leg: '#1b2236', foot: '#0d0f14', obi: '#c3262f', band: '#e5323d', eye: '#141018', blade: '#e9f5f7', hilt: '#251818', tsuba: '#d4a62a' },
  samurai: { s: 1, head: 'human', hat: 'kabuto', skin: '#d9ae86', hair: '#111111', gi: '#3a1d24', arm: '#2c161b', hakama: '#1d1418', leg: '#151013', foot: '#0b0809', armor: '#86242c', trim: '#d9a843', obi: '#d9a843', helm: '#25181c', crest: '#e0b44a', mask: '#3a0f14', eye: '#ffcf40', blade: '#cfd8db', hilt: '#3a1414', tsuba: '#222222' },
  archer: { s: 1, head: 'human', hat: 'kasa', skin: '#d9ae86', hair: '#111111', gi: '#4b5a3a', arm: '#3e4a30', hakama: '#2f3526', leg: '#22261c', foot: '#111111', obi: '#8a6a3a', kasa: '#c9a46a', eye: '#111111' },
  ronin: { s: 1.15, head: 'human', hat: 'kasa', skin: '#e3b892', hair: '#1a1416', gi: '#3a3550', arm: '#2e2a40', hakama: '#17141f', leg: '#100e16', foot: '#0b0a10', obi: '#8f2a2a', kasa: '#a8824e', eye: '#111111', blade: '#eef6f8', hilt: '#1a1a1a', tsuba: '#b9b9c2' },
  shogun: { s: 1.4, head: 'human', hat: 'shogun', skin: '#d9ae86', hair: '#111111', gi: '#1c1c22', arm: '#141418', hakama: '#2a1416', leg: '#120a0b', foot: '#0a0606', armor: '#1f2026', trim: '#d4a640', obi: '#b0242c', helm: '#121217', crest: '#e3b746', mask: '#a01e24', eye: '#ff3a30', blade: '#f2f6ff', hilt: '#3a0d10', tsuba: '#d4a640' },
  oni: { s: 2.6, head: 'oni', skin: '#c23a2c', hair: '#1b0f10', gi: '#c23a2c', arm: '#b3342a', hakama: '#e3a332', leg: '#a8301f', foot: '#2a1210', obi: '#3a2a20', horn: '#efe3c4', eye: '#ffe24a', stripe: '#2a1a12' },
  tengu: { s: 1.3, head: 'tengu', skin: '#cf2f2a', hair: '#f2f2f2', gi: '#ece6d8', arm: '#ddd5c4', hakama: '#3b3c4f', leg: '#272838', foot: '#14141c', obi: '#d4a62a', eye: '#111111', wing: '#14141b', blade: '#e9eef6', hilt: '#251818', tsuba: '#d4a62a' },
  kitsune: { s: 1.12, head: 'kitsune', skin: '#fbf7f0', hair: '#fbf7f0', gi: '#fbf7f0', arm: '#efe8de', hakama: '#c3243a', leg: '#9e1c2e', foot: '#2a0a10', obi: '#7fd8ff', eye: '#c3243a', mark: '#d22a3c' },
};
STYLES.heavy = Object.assign({}, STYLES.samurai, { armor: '#2a2f3a', trim: '#c6ced8', helm: '#14171d', crest: '#d8343c', gi: '#1a1d24', arm: '#14161b', mask: '#111111', eye: '#ff4a3a' });

// the same character, every colour replaced by one (hit flash, glowing outlines)
const _solidCache = new Map();
function solidStyle(st, col) {
  let m = _solidCache.get(st);
  if (!m) { m = new Map(); _solidCache.set(st, m); }
  let w = m.get(col);
  if (!w) {
    w = {};
    for (const k in st) w[k] = typeof st[k] === 'string' && st[k][0] === '#' ? col : st[k];
    m.set(col, w);
  }
  return w;
}
function whiteStyle(st) { return solidStyle(st, '#ffffff'); }

// ---------- poses ----------
const JOINTS = ['head', 'neck', 'hip', 'eB', 'hB', 'eF', 'hF', 'kB', 'fB', 'kF', 'fF'];
const BONES = [['head', 'neck'], ['neck', 'hip'], ['neck', 'eB'], ['eB', 'hB'], ['neck', 'eF'], ['eF', 'hF'], ['hip', 'kB'], ['kB', 'fB'], ['hip', 'kF'], ['kF', 'fF']];
function newPose() { const p = {}; for (const k of JOINTS) p[k] = { x: 0, y: 0 }; return p; }
function copyPose(d, s) { for (const k of JOINTS) { d[k].x = s[k].x; d[k].y = s[k].y; } return d; }
function lerpPose(d, a, b, t) { for (const k of JOINTS) { d[k].x = lerp(a[k].x, b[k].x, t); d[k].y = lerp(a[k].y, b[k].y, t); } return d; }

// Procedural standing / running / airborne pose. Shoulder ends up at
// (x + f*(1+lean*8)*s, footY - 42*s - bob + |lean|*2*s + crouch*s).
function standPose(p, o) {
  const s = o.s || 1, f = o.facing || 1;
  const run = o.run || 0, ph = o.phase || 0, lean = o.lean || 0;
  const crouch = (o.crouch || 0) * s;
  const bob = !o.air && run > 0.1 ? Math.abs(Math.sin(ph)) * 2.2 * s * Math.min(1, run) : 0;
  const hipY = o.footY - 26 * s + crouch - bob;
  p.hip.x = o.x - f * s; p.hip.y = hipY;
  p.neck.x = o.x + f * (1 + lean * 8) * s; p.neck.y = hipY - 19 * s + Math.abs(lean) * 2 * s;
  p.head.x = p.neck.x + f * (1.5 + lean * 2) * s; p.head.y = p.neck.y - 9 * s;
  let fFx, fFy, fBx, fBy;
  if (o.air) {
    const tuck = o.vy < 0 ? 1 : 0.4;
    fFx = p.hip.x + f * 9 * s; fFy = hipY + 22 * s - tuck * 6 * s;
    fBx = p.hip.x - f * 5 * s; fBy = hipY + 24 * s - tuck * 4 * s;
  } else if (run > 0.05) {
    const str = 13 * s * Math.min(1, run);
    fFx = o.x + Math.sin(ph) * str; fFy = o.footY - Math.max(0, Math.cos(ph)) * 7 * s * Math.min(1, run);
    fBx = o.x + Math.sin(ph + Math.PI) * str; fBy = o.footY - Math.max(0, Math.cos(ph + Math.PI)) * 7 * s * Math.min(1, run);
  } else {
    const spread = 7 + (o.crouch || 0) * 0.5;
    fFx = o.x + f * spread * s; fFy = o.footY;
    fBx = o.x - f * (spread - 1) * s; fBy = o.footY;
  }
  p.fF.x = fFx; p.fF.y = fFy; p.fB.x = fBx; p.fB.y = fBy;
  let k = ik2(p.hip.x, p.hip.y, fFx, fFy, 13 * s, 13 * s, -f); p.kF.x = k.x; p.kF.y = k.y;
  k = ik2(p.hip.x, p.hip.y, fBx, fBy, 13 * s, 13 * s, -f); p.kB.x = k.x; p.kB.y = k.y;
  const shx = p.neck.x, shy = p.neck.y + 3 * s;
  const hf = o.hF || { x: shx + f * 6 * s, y: shy + 17 * s };
  p.hF.x = hf.x; p.hF.y = hf.y;
  k = ik2(shx, shy, hf.x, hf.y, 11 * s, 11 * s, f); p.eF.x = k.x; p.eF.y = k.y;
  const hb = o.hB || { x: shx - f * 4 * s + Math.sin(ph + Math.PI) * 7 * s * Math.min(1, run), y: shy + 18 * s - (o.air ? 6 * s : 0) };
  p.hB.x = hb.x; p.hB.y = hb.y;
  k = ik2(shx, shy, hb.x, hb.y, 11 * s, 11 * s, f); p.eB.x = k.x; p.eB.y = k.y;
  return p;
}

// ---------- drawing ----------
function strokeLine(ctx, a, b, w, c) {
  ctx.strokeStyle = c; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function strokeLine3(ctx, a, b, c, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
}
const lp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// a line `len` long from `from`, pointing away from `away` (the stub of a severed limb / half-torso)
function stubEnd(from, away, len) {
  const dx = from.x - away.x, dy = from.y - away.y, d = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / d) * len, y: from.y + (dy / d) * len };
}
function drawStump(ctx, x, y, r) {
  ctx.fillStyle = '#5a0710'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c8142a'; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = '#efe2d0'; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fill(); // bone
}

// cut: severed-part bitmask (CUT.*); headAng: spin of a severed head
function drawFigure(ctx, p, st, f, flash, cut = 0, headAng = null) {
  if (flash) st = whiteStyle(st);
  const s = st.s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stumps = [];
  if (cut & CUT.armB) {
    const e = stubEnd(p.eB, p.hB, 10 * s);
    strokeLine3(ctx, e, p.eB, p.hB, 5 * s, shade(st.arm, -0.3));
    stumps.push([e, 3 * s], [p.neck, 3.5 * s]);
  } else strokeLine3(ctx, p.neck, p.eB, p.hB, 5 * s, shade(st.arm, -0.3));
  strokeLine(ctx, p.kB, p.fB, 6 * s, shade(st.leg, -0.2));
  strokeLine(ctx, p.kF, p.fF, 6 * s, st.leg);
  strokeLine(ctx, p.fB, { x: p.fB.x + f * 4 * s, y: p.fB.y }, 4.5 * s, st.foot);
  strokeLine(ctx, p.fF, { x: p.fF.x + f * 4 * s, y: p.fF.y }, 4.5 * s, st.foot);
  // torso (cut in half at the waist: two stubs)
  const halved = cut & CUT.waist;
  if (halved) {
    const upEnd = stubEnd(p.neck, p.head, 11 * s);
    const knees = { x: (p.kB.x + p.kF.x) / 2, y: (p.kB.y + p.kF.y) / 2 };
    const loEnd = stubEnd(p.hip, knees, 7 * s);
    strokeLine(ctx, p.neck, upEnd, 13 * s, st.armor || st.gi);
    strokeLine(ctx, p.hip, loEnd, 13 * s, st.gi);
    stumps.push([upEnd, 6 * s], [loEnd, 6 * s]);
  } else strokeLine(ctx, p.hip, p.neck, 13 * s, st.gi);
  if (st.armor && !halved) {
    const a = lp(p.hip, p.neck, 0.18), b = lp(p.hip, p.neck, 0.86);
    strokeLine(ctx, a, b, 15 * s, st.armor);
    const dx = p.neck.x - p.hip.x, dy = p.neck.y - p.hip.y, d = Math.hypot(dx, dy) || 1;
    const px = -dy / d, py = dx / d;
    ctx.strokeStyle = st.trim; ctx.lineWidth = 1.4 * s;
    for (let i = 1; i <= 3; i++) {
      const c = lp(a, b, i / 4);
      ctx.beginPath(); ctx.moveTo(c.x - px * 7 * s, c.y - py * 7 * s); ctx.lineTo(c.x + px * 7 * s, c.y + py * 7 * s); ctx.stroke();
    }
    // shoulder guard
    strokeLine(ctx, { x: p.neck.x - f * 3 * s, y: p.neck.y + 3 * s }, { x: p.neck.x - f * 6 * s, y: p.neck.y + 11 * s }, 7 * s, st.armor);
  }
  if (st.head === 'oni') {
    // tiger-skin loincloth
    const c = lp(p.hip, p.neck, 0.05);
    strokeLine(ctx, { x: c.x - 9 * s, y: c.y }, { x: c.x + 9 * s, y: c.y }, 7 * s, st.hakama);
  }
  if (!halved) {
    const ob = lp(p.hip, p.neck, 0.14);
    strokeLine(ctx, { x: ob.x - 6 * s, y: ob.y + 0.5 * s }, { x: ob.x + 6 * s, y: ob.y - 0.5 * s }, 3.5 * s, st.obi);
  }
  // thighs (hakama); a severed leg keeps a thigh stub
  for (const [bit, k, foot, col] of [[CUT.legB, p.kB, p.fB, shade(st.hakama, -0.18)], [CUT.legF, p.kF, p.fF, st.hakama]]) {
    if (cut & bit) {
      const e = stubEnd(k, foot, 11 * s);
      strokeLine(ctx, k, e, 11 * s, col);
      stumps.push([e, 4.5 * s], [p.hip, 5 * s]);
    } else strokeLine(ctx, p.hip, k, 11 * s, col);
  }
  if (st.stripe) {
    ctx.strokeStyle = st.stripe; ctx.lineWidth = 1.6 * s;
    for (const kk of [p.kB, p.kF]) for (let i = 1; i <= 2; i++) {
      const c = lp(p.hip, kk, i / 3);
      ctx.beginPath(); ctx.moveTo(c.x - 4 * s, c.y - 1 * s); ctx.lineTo(c.x + 4 * s, c.y + 1.5 * s); ctx.stroke();
    }
  }
  if (cut & CUT.head) {
    stumps.push([p.neck, 4.5 * s]);
    drawHead(ctx, p, st, f, headAng === null ? 0 : headAng, true);
  } else drawHead(ctx, p, st, f);
  if (cut & CUT.armF) {
    const e = stubEnd(p.eF, p.hF, 10 * s);
    strokeLine3(ctx, e, p.eF, p.hF, 5.5 * s, st.arm);
    stumps.push([e, 3 * s], [p.neck, 3.5 * s]);
  } else strokeLine3(ctx, p.neck, p.eF, p.hF, 5.5 * s, st.arm);
  ctx.fillStyle = st.skin;
  ctx.beginPath(); ctx.arc(p.hF.x, p.hF.y, 2.6 * s, 0, TAU); ctx.fill();
  if (!flash) for (const [pt, r] of stumps) drawStump(ctx, pt.x, pt.y, r);
}

// angOverride / severed: a cut-off head spins on its own and shows the wound at its base
function drawHead(ctx, p, st, f, angOverride = null, severed = false) {
  const s = st.s, h = p.head, r = 7.5 * s;
  const ang = angOverride !== null ? angOverride : Math.atan2(h.y - p.neck.y, h.x - p.neck.x) + Math.PI / 2;
  ctx.save();
  ctx.translate(h.x, h.y); ctx.rotate(ang);
  if (f < 0) ctx.scale(-1, 1);
  if (severed) { // ragged neck under the head
    ctx.fillStyle = st.skin; ctx.fillRect(-r * 0.35, r * 0.6, r * 0.7, r * 0.7);
    ctx.fillStyle = '#b3122a'; ctx.beginPath(); ctx.ellipse(0, r * 1.3, r * 0.42, r * 0.2, 0, 0, TAU); ctx.fill();
  }
  const circ = (x, y, rr, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); };
  const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
  switch (st.head) {
    case 'oni': {
      poly([-r * 1.1, -r * 0.2, -r * 1.5, -r * 0.9, -r * 0.6, -r * 0.6, -r * 1.3, -r * 1.3, -r * 0.2, -r * 0.9, -r * 0.5, r * 0.6], st.hair);
      circ(0, 0, r, st.skin);
      poly([-r * 0.55, -r * 0.6, -r * 0.95, -r * 1.85, -r * 0.1, -r * 0.85], st.horn);
      poly([r * 0.2, -r * 0.8, r * 0.55, -r * 2.0, r * 0.75, -r * 0.55], st.horn);
      circ(r * 0.45, -r * 0.15, r * 0.24, st.eye);
      circ(r * 0.5, -r * 0.15, r * 0.1, '#000');
      ctx.strokeStyle = '#2a0a08'; ctx.lineWidth = r * 0.15;
      ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.5); ctx.lineTo(r * 0.85, -r * 0.3); ctx.stroke();
      poly([r * 0.35, r * 0.4, r * 0.5, r * 0.4, r * 0.42, -r * 0.05], '#fff');
      poly([r * 0.7, r * 0.35, r * 0.85, r * 0.3, r * 0.78, -r * 0.1], '#fff');
      break;
    }
    case 'tengu': {
      circ(-r * 0.3, 0, r * 1.05, st.hair);
      circ(0, 0, r, st.skin);
      ctx.strokeStyle = shade(st.skin, -0.15); ctx.lineWidth = r * 0.45; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.05); ctx.lineTo(r * 2.4, -r * 0.3); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.25;
      ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.5); ctx.lineTo(r * 0.85, -r * 0.35); ctx.stroke();
      circ(r * 0.45, -r * 0.15, r * 0.14, st.eye);
      poly([-r * 0.3, -r * 0.85, r * 0.3, -r * 0.85, r * 0.15, -r * 1.35, -r * 0.2, -r * 1.3], '#111');
      break;
    }
    case 'kitsune': {
      poly([-r * 0.6, -r * 0.5, -r * 0.4, -r * 1.9, r * 0.1, -r * 0.8], st.skin);
      poly([r * 0.05, -r * 0.8, r * 0.55, -r * 1.85, r * 0.8, -r * 0.45], st.skin);
      poly([-r * 0.45, -r * 0.65, -r * 0.35, -r * 1.5, -r * 0.05, -r * 0.8], st.mark);
      circ(0, 0, r, st.skin);
      poly([r * 0.5, -r * 0.4, r * 1.6, r * 0.15, r * 0.4, r * 0.6], st.skin);
      ctx.strokeStyle = st.mark; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.3); ctx.quadraticCurveTo(r * 0.5, -r * 0.45, r * 0.95, -r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.75); ctx.lineTo(r * 0.15, -r * 0.45); ctx.stroke();
      circ(r * 1.55, r * 0.15, r * 0.14, '#111');
      break;
    }
    default: {
      circ(0, 0, r, st.skin);
      ctx.fillStyle = st.hair;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.03, Math.PI * 0.85, Math.PI * 1.85); ctx.closePath(); ctx.fill();
      ctx.fillRect(-r * 0.5, -r * 1.35, r * 0.7, r * 0.5);
      ctx.fillStyle = st.eye || '#111';
      ctx.fillRect(r * 0.4, -r * 0.2, r * 0.25, r * 0.2);
    }
  }
  if (st.hat === 'band') {
    ctx.strokeStyle = st.band; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.3); ctx.lineTo(r * 1.0, -r * 0.5); ctx.stroke();
  } else if (st.hat === 'kasa') {
    poly([-r * 2.2, -r * 0.1, r * 2.2, -r * 0.1, 0, -r * 1.55], st.kasa);
    ctx.strokeStyle = shade(st.kasa, -0.3); ctx.lineWidth = 0.8 * s;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.lineTo(i * r * 0.9, -r * 0.12); ctx.stroke(); }
  } else if (st.hat === 'kabuto' || st.hat === 'shogun') {
    poly([-r * 0.9, -r * 0.2, -r * 1.7, r * 0.9, -r * 0.2, r * 0.7, -r * 0.3, -r * 0.1], st.helm);
    ctx.fillStyle = st.helm;
    ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 1.12, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * 1.25, -r * 0.25, r * 2.6, r * 0.25);
    if (st.mask) { ctx.fillStyle = st.mask; ctx.beginPath(); ctx.arc(r * 0.15, r * 0.15, r * 0.8, -0.2, Math.PI * 0.9); ctx.closePath(); ctx.fill(); }
    circ(r * 0.5, -r * 0.05, r * 0.14, st.eye);
    ctx.strokeStyle = st.crest; ctx.lineWidth = (st.hat === 'shogun' ? 2.4 : 1.8) * s;
    if (st.hat === 'shogun') {
      poly([-r * 0.15, -r * 1.1, r * 0.3, -r * 1.1, r * 0.6, -r * 3.0, r * 0.1, -r * 2.7], st.crest);
      ctx.beginPath(); ctx.arc(r * 0.1, -r * 2.4, r * 1.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(r * 0.1, -r * 2.1, r * 1.0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
}

// katana: hand at (hx,hy), pointing ang, len = hand->tip
function drawKatana(ctx, hx, hy, ang, len, s, st, glow, blood = 0) {
  const c = Math.cos(ang), sn = Math.sin(ang), px = -sn, py = c;
  ctx.lineCap = 'round';
  ctx.strokeStyle = st.hilt || '#2a1a1a'; ctx.lineWidth = 3.6 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 8 * s, hy - sn * 8 * s); ctx.lineTo(hx + c * 6 * s, hy + sn * 6 * s); ctx.stroke();
  ctx.strokeStyle = st.tsuba || '#c9a227'; ctx.lineWidth = 3 * s;
  const tx0 = hx + c * 7.5 * s, ty0 = hy + sn * 7.5 * s;
  ctx.beginPath(); ctx.moveTo(tx0 - px * 4.5 * s, ty0 - py * 4.5 * s); ctx.lineTo(tx0 + px * 4.5 * s, ty0 + py * 4.5 * s); ctx.stroke();
  const bx = hx + c * 9 * s, by = hy + sn * 9 * s, tx = hx + c * len, ty = hy + sn * len;
  const cv = 3.2 * s;
  const mx = (bx + tx) / 2 - px * cv, my = (by + ty) / 2 - py * cv;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
  ctx.strokeStyle = glow || st.blade || '#dfe9ec'; ctx.lineWidth = 3.2 * s;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1 * s;
  ctx.beginPath(); ctx.moveTo(bx + px * 0.8, by + py * 0.8); ctx.quadraticCurveTo(mx + px * 0.8, my + py * 0.8, tx, ty); ctx.stroke();
  if (blood > 0.02 && Settings.gore) { // fresh blood coating the outer edge of the blade
    const sx = lerp(bx, tx, 0.35), sy = lerp(by, ty, 0.35);
    ctx.strokeStyle = `rgba(150,8,20,${Math.min(0.9, blood)})`; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  }
}

// ---------- dismemberment ----------
const CUT = { head: 1, armF: 2, armB: 4, legF: 8, legB: 16, waist: 32 };
const SEVER = {
  head: { remove: [['head', 'neck'], ['head', 'hip']], piece: ['head'] },
  armF: { remove: [['neck', 'eF']], piece: ['eF', 'hF'] },
  armB: { remove: [['neck', 'eB']], piece: ['eB', 'hB'] },
  legF: { remove: [['hip', 'kF']], piece: ['kF', 'fF'] },
  legB: { remove: [['hip', 'kB']], piece: ['kB', 'fB'] },
  waist: { remove: [['neck', 'hip'], ['head', 'hip']], piece: ['head', 'neck', 'eF', 'hF', 'eB', 'hB'] },
};
// which part a blow at (hx, hy) takes off, if any. Harder blows sever more often; force = always.
function pickSever(p, hx, hy, dmg, force) {
  if (!Settings.gore) return null;
  const chance = force || dmg >= 3 ? 1 : dmg === 2 ? 0.6 : 0.3;
  if (Math.random() > chance) return null;
  const segs = [['head', p.head, p.neck], ['armF', p.neck, p.hF], ['armB', p.neck, p.hB], ['legF', p.hip, p.fF], ['legB', p.hip, p.fB], ['torso', p.neck, p.hip]];
  let best = 'torso', bd = 1e9;
  for (const [n, a, b] of segs) {
    const d = pointSegDist(hx, hy, a.x, a.y, b.x, b.y) - (n === 'head' ? 6 : 0);
    if (d < bd) { bd = d; best = n; }
  }
  if (best === 'torso') best = dmg >= 3 || force ? 'waist' : pick(['head', 'armF', 'armB']);
  return best;
}
// open wounds on a (possibly dismembered) pose: [x, y, dirX, dirY, strength]
function stumpPoints(p, cut) {
  const out = [];
  const n = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const up = n(p.neck.x - p.hip.x, p.neck.y - p.hip.y), down = [-up[0], -up[1]];
  if (cut & CUT.head) out.push([p.neck.x, p.neck.y, up[0], up[1], 1], [p.head.x, p.head.y + 6, 0, 1, 0.3]);
  if (cut & CUT.armF) out.push([p.neck.x, p.neck.y + 3, up[0], up[1], 0.6], [p.eF.x, p.eF.y, ...n(p.eF.x - p.hF.x, p.eF.y - p.hF.y), 0.3]);
  if (cut & CUT.armB) out.push([p.neck.x, p.neck.y + 3, up[0], up[1], 0.6], [p.eB.x, p.eB.y, ...n(p.eB.x - p.hB.x, p.eB.y - p.hB.y), 0.3]);
  if (cut & CUT.legF) out.push([p.hip.x, p.hip.y, down[0], down[1], 0.6], [p.kF.x, p.kF.y, ...n(p.kF.x - p.fF.x, p.kF.y - p.fF.y), 0.3]);
  if (cut & CUT.legB) out.push([p.hip.x, p.hip.y, down[0], down[1], 0.6], [p.kB.x, p.kB.y, ...n(p.kB.x - p.fB.x, p.kB.y - p.fB.y), 0.3]);
  if (cut & CUT.waist) {
    const u = n(p.neck.x - p.head.x, p.neck.y - p.head.y);
    const knees = { x: (p.kB.x + p.kF.x) / 2, y: (p.kB.y + p.kF.y) / 2 };
    const l = n(p.hip.x - knees.x, p.hip.y - knees.y);
    out.push([p.neck.x + u[0] * 10, p.neck.y + u[1] * 10, u[0], u[1], 0.9], [p.hip.x + l[0] * 6, p.hip.y + l[1] * 6, l[0], l[1], 0.9]);
  }
  return out;
}
// arterial spray from the wounds: pulses like a heartbeat, gushes hard at first, then trickles out over ~5 s
const BLEED_TIME = 5;
function bleed(p, cut, t, col, scale, dt) {
  if (!cut || !Settings.gore || t > BLEED_TIME) return;
  const fade = 1 - t / BLEED_TIME, pulse = 0.25 + 0.75 * Math.max(0, Math.sin(t * 12));
  for (const [x, y, dx, dy, k] of stumpPoints(p, cut)) {
    const n = 110 * k * (0.4 + fade) * dt * (0.5 + pulse);
    for (let i = 0; i < 3 && Math.random() < n - i; i++) {
      const sp = (90 + 560 * pulse) * fade * rand(0.55, 1.25), a = Math.atan2(dy, dx) + rand(-0.32, 0.32);
      FX.add({ t: 'blob', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2, max: 2, col, grav: 1400, size: rand(1.4, 3.4) * scale });
    }
  }
}

function drawStars(ctx, x, y, t, r = 12) {
  ctx.fillStyle = '#ffe56a';
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * TAU) / 3;
    const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.35;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const aa = (k * TAU * 2) / 5 - Math.PI / 2;
      ctx.lineTo(sx + Math.cos(aa) * 3.5, sy + Math.sin(aa) * 3.5);
    }
    ctx.closePath(); ctx.fill();
  }
}

// ---------- verlet ragdoll ----------
function pushOut(L, q) {
  if (!L.solidAt(q.x, q.y)) return;
  const tx = Math.floor(q.x / T), ty = Math.floor(q.y / T);
  let best = 1e9, bx = q.x, by = q.y;
  if (!L.solid(tx, ty - 1)) { const d = q.y - ty * T; if (d < best) { best = d; bx = q.x; by = ty * T - 0.1; } }
  if (!L.solid(tx, ty + 1)) { const d = (ty + 1) * T - q.y; if (d < best) { best = d; bx = q.x; by = (ty + 1) * T + 0.1; } }
  if (!L.solid(tx - 1, ty)) { const d = q.x - tx * T; if (d < best) { best = d; bx = tx * T - 0.1; by = q.y; } }
  if (!L.solid(tx + 1, ty)) { const d = (tx + 1) * T - q.x; if (d < best) { best = d; bx = (tx + 1) * T + 0.1; by = q.y; } }
  if (best < 1e9) {
    if (bx !== q.x) q.ox = bx; if (by !== q.y) q.oy = by;
    q.x = bx; q.y = by;
  }
}

class Ragdoll {
  constructor(pose, vx, vy, spin = 0) {
    this.p = {};
    const cx = pose.hip.x, cy = pose.hip.y;
    for (const k of JOINTS) {
      const q = pose[k];
      const rx = q.x - cx, ry = q.y - cy;
      const svx = vx - ry * spin, svy = vy + rx * spin;
      const j = 0.85 + Math.random() * 0.3;
      this.p[k] = { x: q.x, y: q.y, ox: q.x - svx * STEP * j, oy: q.y - svy * STEP * j };
    }
    const d = (a, b) => Math.hypot(pose[a].x - pose[b].x, pose[a].y - pose[b].y);
    this.c = BONES.map(([a, b]) => [a, b, d(a, b)]);
    this.c.push(['head', 'hip', d('head', 'hip')]);
    this.cut = 0;
  }
  // cut a part off: drop the joints holding it on and fling it away. Returns true if newly cut.
  sever(part, vx, vy) {
    const def = SEVER[part];
    if (!def || this.cut & CUT[part]) return false;
    this.cut |= CUT[part];
    this.c = this.c.filter(([a, b]) => !def.remove.some(([x, y]) => (a === x && b === y) || (a === y && b === x)));
    for (const k of def.piece) {
      const q = this.p[k];
      q.ox -= (vx + rand(-60, 60)) * STEP; q.oy -= (vy + rand(-60, 60)) * STEP;
    }
    return true;
  }
  update(dt, L) {
    const g = GRAV * dt * dt;
    for (const k in this.p) {
      const q = this.p[k];
      const vx = (q.x - q.ox) * 0.995, vy = (q.y - q.oy) * 0.995 + g;
      q.ox = q.x; q.oy = q.y;
      q.x += vx;
      if (L.solidAt(q.x, q.y)) { q.x = q.ox; q.ox = q.x + vx * 0.4; }
      q.y += vy;
      const t = L.tileAt(q.x, q.y);
      // solid rock, or a one-way ledge landed on from above
      if (t === 1 || (t === 2 && vy > 0 && q.oy <= Math.floor(q.y / T) * T + 0.5)) {
        q.y = q.oy; q.oy = q.y + vy * 0.3; q.ox = q.x - (q.x - q.ox) * 0.6;
      }
    }
    for (let it = 0; it < 5; it++) {
      for (const [a, b, len] of this.c) {
        const A = this.p[a], B = this.p[b];
        let dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = ((d - len) / d) * 0.5;
        dx *= diff; dy *= diff;
        A.x += dx; A.y += dy; B.x -= dx; B.y -= dy;
      }
    }
    for (const k in this.p) pushOut(L, this.p[k]);
  }
  kick(vx, vy) { for (const k in this.p) { const q = this.p[k]; q.ox -= vx * STEP; q.oy -= vy * STEP; } }
  toPose(pose) { for (const k of JOINTS) { pose[k].x = this.p[k].x; pose[k].y = this.p[k].y; } return pose; }
  speed() { const q = this.p.hip; return Math.hypot(q.x - q.ox, q.y - q.oy) / STEP; }
}

// light verlet rope (headband tails, scarves)
class Rope {
  constructor(n, seg, x, y) {
    this.seg = seg; this.pts = [];
    for (let i = 0; i < n; i++) this.pts.push({ x: x - i * seg, y, ox: x - i * seg, oy: y });
  }
  update(ax, ay, wind) {
    const P = this.pts;
    P[0].x = P[0].ox = ax; P[0].y = P[0].oy = ay;
    for (let i = 1; i < P.length; i++) {
      const q = P[i];
      const vx = (q.x - q.ox) * 0.9 + wind, vy = (q.y - q.oy) * 0.9 + 0.1;
      q.ox = q.x; q.oy = q.y; q.x += vx; q.y += vy;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
        const k = (d - this.seg) / d;
        if (i === 1) { b.x -= dx * k; b.y -= dy * k; }
        else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; }
      }
    }
  }
  reset(x, y) { for (const q of this.pts) { q.x = q.ox = x; q.y = q.oy = y; } }
  draw(ctx, col, w) {
    const P = this.pts;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
    ctx.stroke();
  }
}
