'use strict';
// Particles, floating text, ground decals and loose props (flying hats etc).
const FX = {
  parts: [], texts: [], decals: [], props: [],
  screen: [], // blood splashed onto the camera (screen space)
  clear() { this.parts.length = 0; this.texts.length = 0; this.decals.length = 0; this.props.length = 0; this.screen.length = 0; },
  // a close kill sprays the lens: blotches that slowly run down the screen and fade
  screenSplat(n, col = '#8e0a18') {
    if (!Settings.gore) return;
    for (let i = 0; i < n; i++) {
      if (this.screen.length > 40) this.screen.shift();
      const r = rand(8, 46);
      const dots = [];
      for (let k = 0; k < 6; k++) dots.push([rand(-1.6, 1.6) * r, rand(-1.6, 1.6) * r, rand(0.1, 0.35) * r]);
      this.screen.push({ x: rand(0.05, 0.95), y: rand(0.05, 0.75), r, a: rand(0.55, 0.85), run: 0, speed: rand(4, 18), col, dots });
    }
  },
  drawScreen(ctx, vw, vh, dt) {
    for (const s of this.screen) {
      s.run += s.speed * dt; s.a -= dt * 0.12;
      const x = s.x * vw, y = s.y * vh;
      ctx.globalAlpha = Math.max(0, s.a); ctx.fillStyle = s.col; ctx.strokeStyle = s.col;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
      for (const [dx, dy, rr] of s.dots) { ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, TAU); ctx.fill(); }
      ctx.lineWidth = s.r * 0.35; ctx.lineCap = 'round'; // the run
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s.r * 0.15, y + s.r * 0.6 + s.run); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + s.r * 0.15, y + s.r * 0.6 + s.run, s.r * 0.26, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.screen = this.screen.filter((s) => s.a > 0);
  },
  add(p) {
    if (this.parts.length >= 2200) return;
    if (p.vx === undefined) p.vx = 0;
    if (p.vy === undefined) p.vy = 0;
    if (p.grav === undefined) p.grav = 0;
    this.parts.push(p);
  },

  spark(x, y, n = 8, ang = null, spread = TAU, spd = 500, col = '#fff6c8') {
    for (let i = 0; i < n; i++) {
      const a = ang === null ? rand(0, TAU) : ang + rand(-spread / 2, spread / 2);
      const s = spd * rand(0.35, 1.1);
      this.add({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.12, 0.32), max: 0.32, col, grav: 500, size: rand(1.4, 2.6) });
    }
  },
  // a cut: a jet along the slash plus a smaller back-spray and a fine mist
  blood(x, y, n, dx, dy, col = '#b3122a') {
    if (!Settings.gore) n = Math.ceil(n * 0.3);
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const back = Math.random() < 0.2;
      const a = (back ? base + Math.PI : base) + rand(-0.55, 0.55), s = back ? rand(80, 260) : rand(160, 720);
      this.add({ t: 'blob', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 2, max: 2, col, grav: 1400, size: rand(1.6, 4.8) });
    }
    if (Settings.gore) for (let i = 0; i < n * 0.6; i++) {
      const a = base + rand(-1, 1), s = rand(40, 180);
      this.add({ t: 'mist', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5, max: 0.5, col, grav: 200, size: rand(3, 7) });
    }
  },
  // a pool that spreads under a body; returns the decal so the caller can keep growing it
  pool(x, y, col) {
    const d = { x, y, r: 2, col, pool: true };
    this.addDecal(d);
    return d;
  },
  // stains soak together: a drop landing on an existing stain grows it instead of adding another,
  // and when there are too many, the oldest splats go first (pools are never thrown away)
  addDecal(d) {
    if (!d.pool) {
      for (let i = this.decals.length - 1, n = 0; i >= 0 && n < 90; i--, n++) {
        const e = this.decals[i];
        if (e.pool || !!e.wall !== !!d.wall || e.col !== d.col) continue;
        if (Math.abs(e.x - d.x) < e.r * 1.3 + 2 && Math.abs(e.y - d.y) < (d.wall ? e.r * 1.2 + 2 : 3)) {
          e.r = Math.min(e.r + d.r * 0.22, d.wall ? 9 : 22);
          return;
        }
      }
    }
    this.decals.push(d);
    if (this.decals.length > 1200) {
      const i = this.decals.findIndex((e) => !e.pool);
      this.decals.splice(i < 0 ? 0 : i, 1);
    }
  },
  // a droplet hits rock: splat on floors, run down walls, splash if it was fast
  splat(p, L) {
    p.life = 0;
    const sp = Math.hypot(p.vx, p.vy);
    const floor = !L.solidAt(p.x, p.y - 8) && p.vy > 0;
    if (floor) {
      const y = Math.floor(p.y / T) * T + 1;
      this.addDecal({ x: p.x, y, r: p.size * (1 + Math.min(sp, 900) / 450) * rand(0.8, 1.3), col: p.col });
      if (sp > 380 && Settings.gore) for (let i = 0; i < 2; i++) {
        this.add({ t: 'blob', x: p.x, y: y - 2, vx: p.vx * 0.3 + rand(-90, 90), vy: -rand(80, 200), life: 0.6, max: 0.6, col: p.col, grav: 1400, size: p.size * 0.45, tiny: true });
      }
    } else {
      // walls and ceilings: a smear, then it runs down the face of the rock
      this.addDecal({ x: p.x, y: p.y, r: p.size * rand(0.9, 1.4), col: p.col, wall: true });
      if (Settings.gore && Math.random() < 0.6) this.add({ t: 'drip', x: p.x - sgn(p.vx) * 1.5, y: p.y, y0: p.y, vx: 0, vy: rand(14, 32), grav: 0, life: rand(1.5, 3.5), max: 3.5, col: p.col, size: p.size * 0.5 });
    }
  },
  dust(x, y, n = 6, col = 'rgba(225,235,225,0.5)', spd = 80) {
    for (let i = 0; i < n; i++) this.add({ t: 'dust', x: x + rand(-8, 8), y, vx: rand(-spd, spd), vy: rand(-spd * 0.8, -10), life: rand(0.35, 0.6), max: 0.6, col, grav: -40, size: rand(4, 9) });
  },
  smoke(x, y, n = 10, col = 'rgba(240,240,255,0.55)') {
    for (let i = 0; i < n; i++) this.add({ t: 'dust', x: x + rand(-14, 14), y: y + rand(-20, 20), vx: rand(-60, 60), vy: rand(-90, -20), life: rand(0.4, 0.8), max: 0.8, col, grav: -30, size: rand(8, 16) });
  },
  ring(x, y, r0, r1, col = '#ffffff', life = 0.35, w = 3) { this.add({ t: 'ring', x, y, r0, r1, col, life, max: life, w }); },
  glint(x, y, col = '#ffffff', size = 26) { this.add({ t: 'glint', x, y, col, life: 0.4, max: 0.4, size }); },
  fire(x, y, n, col = '#7fd8ff', spd = 60) {
    for (let i = 0; i < n; i++) this.add({ t: 'fire', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-spd, spd), vy: rand(-spd * 1.5, 0), life: rand(0.25, 0.55), max: 0.55, col, grav: -120, size: rand(3, 7) });
  },
  feathers(x, y, n) {
    for (let i = 0; i < n; i++) this.add({ t: 'feather', x, y, vx: rand(-200, 200), vy: rand(-260, -40), life: rand(1.2, 2), max: 2, col: '#15151c', grav: 160, size: rand(5, 9), rot: rand(0, TAU), vr: rand(-6, 6) });
  },
  debris(x, y, n, col = '#3c3434') {
    for (let i = 0; i < n; i++) this.add({ t: 'chunk', x, y, vx: rand(-320, 320), vy: rand(-650, -150), life: rand(0.8, 1.3), max: 1.3, col, grav: 1800, size: rand(3, 8), rot: rand(0, TAU), vr: rand(-10, 10) });
  },
  ambientWind(x, y, dir) {
    this.add({ t: 'streak', x, y, vx: dir * rand(700, 1100), vy: rand(-30, 30), life: rand(0.3, 0.6), max: 0.6, col: 'rgba(255,255,255,0.55)', grav: 0, size: rand(20, 60) });
  },
  text(x, y, str, col = '#ffffff', size = 18, o = {}) {
    this.texts.push({ x, y, str, col, size, life: o.life || 0.9, max: o.life || 0.9, vy: o.vy !== undefined ? o.vy : -70, bubble: !!o.bubble, font: o.font || null });
  },
  // the parry: starburst, manga speed lines, double shock rings, a shower of sparks, screen flash + zoom punch
  parryBurst(x, y, s = 1) {
    const rays = [];
    for (let i = 0; i < 16; i++) rays.push([(i / 16) * TAU + rand(-0.12, 0.12), rand(0.45, 1)]);
    this.add({ t: 'burst', x, y, life: 0.34, max: 0.34, size: 170 * s, rays });
    if (s >= 0.8) {
      const lines = [];
      for (let i = 0; i < 34; i++) lines.push([rand(0, TAU), rand(1, 3.2), rand(110, 190)]);
      this.add({ t: 'lines', x, y, life: 0.3, max: 0.3, rays: lines });
      G.flash = Math.max(G.flash, 0.28 * s);
      G.zoomKick = Math.max(G.zoomKick, 0.07 * s);
      this.text(x, y - 52, '弾', '#ffffff', 70, { life: 0.75, vy: -24, font: 'mincho' });
    }
    this.ring(x, y, 8, 130 * s, '#ffffff', 0.35, 6);
    this.ring(x, y, 4, 240 * s, '#9fe8ff', 0.55, 2.5);
    this.spark(x, y, Math.round(44 * s), null, TAU, 1100 * s + 200, '#fff6c8');
    this.spark(x, y, Math.round(18 * s), null, TAU, 650, '#9fe8ff');
  },
  prop(o) { if (this.props.length > 40) this.props.shift(); this.props.push(Object.assign({ rot: 0, vr: 0, life: 6, rest: false }, o)); },

  update(dt) {
    const L = G.level;
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      if (p.t === 'feather') { p.vx *= 1 - 2 * dt; p.vy = Math.min(p.vy, 90); p.x += Math.sin(p.life * 6) * 30 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
      if (p.t === 'blob' && L && L.solidAt(p.x, p.y)) {
        if (p.tiny) { p.life = 0; continue; }
        this.splat(p, L);
      }
      if (p.t === 'drip' && L) { // keeps running while there's rock beside it and air below
        if (L.solidAt(p.x, p.y + 3) || (!L.solidAt(p.x + 3, p.y) && !L.solidAt(p.x - 3, p.y))) { p.vy = 0; }
      }
      if (p.t === 'mist') { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
      if (p.t === 'chunk' && L && L.solidAt(p.x, p.y)) { p.vy *= -0.35; p.vx *= 0.6; p.y -= 2; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - 2.5 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const p of this.props) {
      p.life -= dt;
      if (p.rest) continue;
      p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (L && L.solidAt(p.x, p.y + 4)) {
        p.y = Math.floor((p.y + 4) / T) * T - 4;
        if (Math.abs(p.vy) < 200) { p.rest = true; p.rot = Math.round(p.rot / Math.PI) * Math.PI; }
        p.vy *= -0.35; p.vx *= 0.5; p.vr *= 0.5;
      }
    }
    this.props = this.props.filter((p) => p.life > 0);
  },

  drawDecals(ctx) {
    for (const d of this.decals) {
      ctx.fillStyle = d.col;
      if (d.pool) { // wet pool: darker rim, glossy centre
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.5, d.r * 0.3, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.5, d.r * 0.3, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff8a90'; ctx.beginPath(); ctx.ellipse(d.x - d.r * 0.3, d.y - d.r * 0.05, d.r * 0.5, d.r * 0.08, 0, 0, TAU); ctx.fill();
      } else if (d.wall) {
        ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.7, d.r * 1.1, 0, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.6, d.r * 0.45, 0, 0, TAU); ctx.fill();
        // satellite droplets around a big splat
        if (d.r > 4) for (let i = 0; i < 3; i++) {
          const h = hash2(Math.round(d.x * 7) + i, Math.round(d.y));
          ctx.beginPath(); ctx.arc(d.x + (h - 0.5) * d.r * 5, d.y + (hash2(i, Math.round(d.x)) - 0.5) * 2, 0.6 + h * 1.4, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  },
  drawProps(ctx) {
    for (const p of this.props) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life);
      p.draw(ctx);
      ctx.restore();
    }
  },
  draw(ctx) {
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      switch (p.t) {
        case 'spark': {
          ctx.strokeStyle = p.col; ctx.globalAlpha = k; ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
          break;
        }
        case 'blob': { // droplets stretch along their motion
          const sp = Math.hypot(p.vx, p.vy), len = p.size + Math.min(sp * 0.014, 9);
          ctx.fillStyle = p.col; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, len, p.size * 0.85, Math.atan2(p.vy, p.vx), 0, TAU); ctx.fill();
          break;
        }
        case 'mist': ctx.fillStyle = p.col; ctx.globalAlpha = k * 0.3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, TAU); ctx.fill(); break;
        case 'drip': {
          ctx.strokeStyle = p.col; ctx.globalAlpha = Math.min(1, k * 2) * 0.85; ctx.lineWidth = p.size * 1.6;
          ctx.beginPath(); ctx.moveTo(p.x, p.y0); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.3, 0, TAU); ctx.fill();
          break;
        }
        case 'dust': ctx.fillStyle = p.col; ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, TAU); ctx.fill(); break;
        case 'ring': {
          ctx.strokeStyle = p.col; ctx.globalAlpha = k; ctx.lineWidth = p.w * k + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.r1, p.r0, k), 0, TAU); ctx.stroke();
          break;
        }
        case 'glint': {
          const s = p.size * Math.sin(k * Math.PI);
          ctx.fillStyle = p.col; ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.12, p.y - s * 0.12); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x + s * 0.12, p.y + s * 0.12);
          ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.12, p.y + s * 0.12); ctx.lineTo(p.x - s, p.y); ctx.lineTo(p.x - s * 0.12, p.y - s * 0.12);
          ctx.closePath(); ctx.fill();
          break;
        }
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = p.col; ctx.globalAlpha = k * 0.8;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k + 1, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'feather': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.3, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'chunk': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillStyle = p.col; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        }
        case 'streak': {
          ctx.strokeStyle = p.col; ctx.globalAlpha = Math.sin(k * Math.PI); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - sgn(p.vx) * p.size, p.y); ctx.stroke();
          break;
        }
        case 'burst': {
          const e = 1 - k;
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,246,200,${k})`;
          for (const [a, l] of p.rays) {
            const len = p.size * l * (0.35 + e * 0.9), w = 8 * k + 1;
            const c = Math.cos(a), s = Math.sin(a);
            ctx.beginPath(); ctx.moveTo(p.x - s * w, p.y + c * w); ctx.lineTo(p.x + c * len, p.y + s * len); ctx.lineTo(p.x + s * w, p.y - c * w); ctx.closePath(); ctx.fill();
          }
          const r = 46 * k + 8;
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'lines': {
          ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(255,255,255,${0.6 * k})`;
          for (const [a, w, r0] of p.rays) {
            const c = Math.cos(a), s = Math.sin(a), rr = r0 + (1 - k) * 70;
            ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(p.x + c * rr, p.y + s * rr); ctx.lineTo(p.x + c * 1000, p.y + s * 1000); ctx.stroke();
          }
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  },
  drawTexts(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.font = t.font === 'mincho'
        ? `800 ${Math.round(t.size * pop)}px "Shippori Mincho B1", serif`
        : `800 ${Math.round(t.size * pop)}px "Zen Kaku Gothic New", system-ui, sans-serif`;
      if (t.bubble) {
        const w = ctx.measureText(t.str).width + 14;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.roundRect(t.x - w / 2, t.y - t.size * 0.75, w, t.size * 1.5, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(t.x - 4, t.y + t.size * 0.7); ctx.lineTo(t.x + 4, t.y + t.size * 0.7); ctx.lineTo(t.x, t.y + t.size * 0.7 + 7); ctx.fill();
        ctx.fillStyle = '#1a1414'; ctx.fillText(t.str, t.x, t.y + 1);
      } else {
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.col; ctx.fillText(t.str, t.x, t.y);
      }
    }
    ctx.globalAlpha = 1;
  },
};
