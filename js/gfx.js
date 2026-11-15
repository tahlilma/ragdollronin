'use strict';
// Scene dressing: everything here is painted once into offscreen canvases and then blitted every frame,
// so the pretty parts cost a handful of drawImage calls.
const Gfx = {
  _glow: new Map(), scene: null, motes: [], bolt: 0, boltNext: 6,

  canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; },

  // soft additive light
  glowSprite(col) {
    let c = this._glow.get(col);
    if (c) return c;
    c = this.canvas(128, 128);
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, hexA(col, 1)); gr.addColorStop(0.25, hexA(col, 0.55)); gr.addColorStop(0.6, hexA(col, 0.16)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this._glow.set(col, c);
    return c;
  },
  glow(ctx, x, y, r, col, a = 1) {
    if (a <= 0) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(this.glowSprite(col), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
  // a soft blob: radial gradient squashed into an ellipse
  blob(g, x, y, rx, ry, col, a) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, hexA(col, a)); gr.addColorStop(0.5, hexA(col, a * 0.5)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  },

  // (re)build the painted scene for a palette at the current view size
  build(pal, vw, vh) {
    const s = this.scene;
    if (s && s.pal === pal && s.vw === vw && s.vh === vh) return s;
    const sc = { pal, vw, vh };
    // --- sky: three-stop gradient, stars, a faint band of light on the horizon
    sc.sky = this.canvas(vw, vh);
    let g = sc.sky.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, vh);
    gr.addColorStop(0, pal.skyTop); gr.addColorStop(0.55, pal.skyMid || mixHex(pal.skyTop, pal.skyBot, 0.6)); gr.addColorStop(1, pal.skyBot);
    g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
    const R = mulberry32(977);
    const n = Math.round((pal.stars || 0) * 260);
    for (let i = 0; i < n; i++) {
      const x = R() * vw, y = R() * R() * vh * 0.75, r = 0.5 + R() * R() * 1.6;
      g.globalAlpha = (0.3 + R() * 0.7) * (1 - y / (vh * 0.8));
      g.fillStyle = R() < 0.2 ? pal.moon : '#ffffff';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (r > 1.6) { g.fillRect(x - r * 3, y - 0.4, r * 6, 0.8); g.fillRect(x - 0.4, y - r * 3, 0.8, r * 6); }
    }
    g.globalAlpha = 1;
    this.blob(g, vw * 0.5, vh * 0.93, vw * 0.75, vh * 0.28, mixHex(pal.skyBot, '#ffffff', 0.35), 0.5);
    // --- moon / sun with halo
    const big = pal.orb === 'sun';
    sc.orbR = big ? 92 : 62;
    sc.orb = this.canvas(720, 720);
    g = sc.orb.getContext('2d');
    gr = g.createRadialGradient(360, 360, sc.orbR * 0.6, 360, 360, 360);
    gr.addColorStop(0, `rgba(${pal.glow},${big ? 0.75 : 0.6})`); gr.addColorStop(0.3, `rgba(${pal.glow},0.22)`); gr.addColorStop(1, `rgba(${pal.glow},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 720, 720);
    gr = g.createRadialGradient(360 - sc.orbR * 0.3, 360 - sc.orbR * 0.3, sc.orbR * 0.1, 360, 360, sc.orbR);
    gr.addColorStop(0, mixHex(pal.moon, '#ffffff', 0.6)); gr.addColorStop(0.75, pal.moon); gr.addColorStop(1, mixHex(pal.moon, pal.skyMid || pal.skyBot, 0.35));
    g.fillStyle = gr; g.beginPath(); g.arc(360, 360, sc.orbR, 0, TAU); g.fill();
    if (!big) { // craters
      g.save(); g.beginPath(); g.arc(360, 360, sc.orbR, 0, TAU); g.clip();
      g.fillStyle = mixHex(pal.moon, pal.skyTop, 0.5);
      for (const [x, y, r] of [[-20, -14, 13], [16, 8, 17], [-10, 26, 9], [28, -24, 8], [-34, 10, 6], [4, -34, 6]]) { g.globalAlpha = 0.16; g.beginPath(); g.arc(360 + x, 360 + y, r, 0, TAU); g.fill(); }
      g.restore(); g.globalAlpha = 1;
    }
    // --- light shafts fanning down from the orb
    sc.rays = this.canvas(1100, 900);
    g = sc.rays.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.5 + (i - 4) * 0.2 + (R() - 0.5) * 0.08, w = 0.035 + R() * 0.05, len = 760 + R() * 120;
      gr = g.createLinearGradient(550, 0, 550 + Math.cos(a) * len, Math.sin(a) * len);
      gr.addColorStop(0, `rgba(${pal.glow},0.5)`); gr.addColorStop(1, `rgba(${pal.glow},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(550, 0); g.lineTo(550 + Math.cos(a - w) * len, Math.sin(a - w) * len); g.lineTo(550 + Math.cos(a + w) * len, Math.sin(a + w) * len); g.closePath(); g.fill();
    }
    // --- drifting cloud bank (tiles horizontally)
    sc.clouds = this.tile(1536, 320, (g2, R2) => {
      const lit = mixHex(pal.skyBot, '#ffffff', 0.45), dark = mixHex(pal.skyMid || pal.skyTop, pal.skyTop, 0.3);
      for (let i = 0; i < 16; i++) {
        const x = R2() * 1536, y = 60 + R2() * 190, w = 150 + R2() * 240;
        for (let k = 0; k < 4; k++) this.blob(g2, x + (R2() - 0.5) * w, y + 12 + (R2() - 0.5) * 20, w * (0.35 + R2() * 0.3), 20 + R2() * 16, dark, pal.storm ? 0.5 : 0.22);
        for (let k = 0; k < 4; k++) this.blob(g2, x + (R2() - 0.5) * w, y + (R2() - 0.5) * 18, w * (0.3 + R2() * 0.3), 14 + R2() * 12, lit, pal.storm ? 0.1 : 0.2);
      }
    });
    // --- ground mist
    sc.fog = this.tile(1024, 280, (g2, R2) => {
      for (let i = 0; i < 26; i++) this.blob(g2, R2() * 1024, 90 + R2() * 150, 140 + R2() * 220, 26 + R2() * 46, pal.fog, 0.2 + R2() * 0.16);
    });
    // --- out-of-focus foreground silhouettes along the bottom edge
    sc.fg = this.tile(2048, 200, (g2, R2) => this.paintForeground(g2, R2, pal));
    // --- vignette, tinted with the sky so the corners aren't dead black
    sc.vig = this.canvas(vw / 2, vh / 2);
    g = sc.vig.getContext('2d');
    gr = g.createRadialGradient(vw / 4, vh / 4, vh * 0.18, vw / 4, vh / 4, vh * 0.52);
    const tint = mixHex(pal.skyTop, '#000000', 0.55);
    gr.addColorStop(0, hexA(tint, 0)); gr.addColorStop(0.6, hexA(tint, 0.22)); gr.addColorStop(1, hexA(tint, 0.74));
    g.fillStyle = gr; g.fillRect(0, 0, vw / 2, vh / 2);
    this.scene = sc;
    this.initMotes(pal);
    return sc;
  },
  // paint into a strip that wraps seamlessly: everything is drawn three times, one strip-width apart
  tile(w, h, paint) {
    const c = this.canvas(w, h), g = c.getContext('2d');
    for (const off of [-w, 0, w]) { g.save(); g.translate(off, 0); paint(g, mulberry32(4242)); g.restore(); }
    return c;
  },
  paintForeground(g, R, pal) {
    const H = 200, col = pal.fg;
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    g.fillRect(0, H - 34, 2048, 34);
    if (pal.fgk === 'rocks') {
      for (let i = 0; i < 26; i++) {
        const x = R() * 2048, w = 40 + R() * 110, h = 30 + R() * 80;
        g.beginPath(); g.moveTo(x - w, H); g.lineTo(x - w * 0.6, H - h * 0.7); g.lineTo(x - w * 0.1, H - h); g.lineTo(x + w * 0.5, H - h * 0.8); g.lineTo(x + w, H); g.closePath(); g.fill();
      }
      return;
    }
    if (pal.fgk === 'pine') {
      for (let i = 0; i < 22; i++) {
        const x = R() * 2048, h = 70 + R() * 110;
        for (let k = 0; k < 4; k++) { const w = h * (0.4 - k * 0.08), y = H - 20 - k * h * 0.22; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.lineTo(x, y - h * 0.34); g.closePath(); g.fill(); }
      }
    }
    if (pal.fgk === 'bamboo') {
      for (let i = 0; i < 30; i++) {
        const x = R() * 2048, h = 90 + R() * 100, lean = (R() - 0.5) * 60;
        g.lineWidth = 6 + R() * 6; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.5, x + lean, H - h); g.stroke();
        for (let k = 0; k < 4; k++) {
          const t = 0.5 + R() * 0.5, px = x + lean * t * t, py = H - h * t, a = (R() - 0.5) * 2.4, l = 30 + R() * 30;
          g.save(); g.translate(px, py); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -7, l, 3); g.quadraticCurveTo(l * 0.5, 6, 0, 0); g.fill(); g.restore();
        }
      }
    }
    // tall grass everywhere
    for (let i = 0; i < 520; i++) {
      const x = R() * 2048, h = 26 + R() * R() * 120, lean = (R() - 0.5) * 50, w = 3 + R() * 5;
      g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); g.quadraticCurveTo(x + lean * 0.5, H - h * 0.5, x + w, H); g.closePath(); g.fill();
    }
  },

  // ---- per-frame layers (screen space) ----
  drawSky(c, sc, cam, vw, vh, time) {
    c.drawImage(sc.sky, 0, 0, vw, vh);
    const vy = 360 - cam.y;
    const mx = vw * 0.68 - cam.x * 0.015, my = (sc.pal.orb === 'sun' ? vh * 0.5 : 150) + vy * 0.04;
    if (this.bolt > 0) { c.fillStyle = `rgba(210,225,255,${this.bolt * 0.5})`; c.fillRect(0, 0, vw, vh); }
    c.save();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.09 + Math.sin(time * 0.6) * 0.025;
    c.translate(mx, my); c.rotate(Math.sin(time * 0.13) * 0.06);
    c.drawImage(sc.rays, -550, 0);
    c.restore();
    c.drawImage(sc.orb, mx - 360, my - 360);
    const off = -(((cam.x * 0.03 + time * 7) % 1536) + 1536) % 1536;
    for (let x = off; x < vw; x += 1536) c.drawImage(sc.clouds, x, 20 + vy * 0.03);
  },
  // mist: `depth` 0 = behind the terrain, 1 = in front of everything
  drawFog(c, sc, cam, vw, vh, time, depth) {
    const f = depth ? 1.25 : 0.62, sp = depth ? 22 : -12;
    const groundY = 560 - cam.y + vh / 2;
    const off = -(((cam.x * f + time * sp) % 1024) + 1024) % 1024;
    c.globalAlpha = depth ? 0.3 : 0.85;
    const y = groundY - (depth ? 150 : 250), hh = depth ? 330 : 300;
    for (let x = off; x < vw; x += 1024) c.drawImage(sc.fog, x, y, 1024, hh);
    c.globalAlpha = 1;
  },
  drawForeground(c, sc, cam, vw, vh) {
    const off = -(((cam.x * 1.4) % 2048) + 2048) % 2048;
    const y = vh - 108 + (cam.y - (720 - vh / 2)) * -1.4;
    if (y > vh) return;
    for (let x = off; x < vw; x += 2048) c.drawImage(sc.fg, x, y);
  },
  drawVignette(c, sc, vw, vh) { c.drawImage(sc.vig, 0, 0, vw, vh); },

  // ---- weather / floating particles ----
  initMotes(pal) {
    const n = pal.pkind === 'rain' ? 150 : pal.pkind === 'firefly' ? 46 : 80;
    this.motes = [];
    for (let i = 0; i < n; i++) this.motes.push({ x: Math.random() * 1800, y: Math.random() * 1000, z: rand(0.35, 1.3), ph: rand(0, TAU) });
  },
  drawMotes(c, rdt, pal, cam, vw, vh) {
    const kind = pal.pkind;
    if (pal.storm) { // lightning
      this.boltNext -= rdt; this.bolt = Math.max(0, this.bolt - rdt * 3);
      if (this.boltNext <= 0) { this.boltNext = rand(5, 13); this.bolt = 1; if (G.state === 'play') Sound.boom(0.22); }
    } else this.bolt = 0;
    const W = vw + 100, H = vh + 100;
    const wind = G.wind || 0;
    if (kind === 'rain') {
      c.strokeStyle = hexA(pal.particle, 0.34); c.lineWidth = 1.2; c.beginPath();
      for (const m of this.motes) {
        m.x += (-260 + wind * 0.4) * m.z * rdt; m.y += 1500 * m.z * rdt;
        const sx = (((m.x - cam.x * m.z * 0.6) % W) + W) % W - 50, sy = ((m.y % H) + H) % H - 50;
        c.moveTo(sx, sy); c.lineTo(sx - 5 * m.z, sy + 28 * m.z);
      }
      c.stroke();
      return;
    }
    const glowing = kind === 'ember' || kind === 'firefly';
    const spr = glowing ? this.glowSprite(pal.particle) : null;
    if (glowing) c.globalCompositeOperation = 'lighter';
    c.fillStyle = pal.particle;
    for (const m of this.motes) {
      m.ph += rdt;
      let vx = 0, vy = 0;
      switch (kind) {
        case 'ember': vx = Math.sin(m.ph) * 18 + 10; vy = -46 * m.z; break;
        case 'snow': vx = -24 * m.z + wind * 0.3 + Math.sin(m.ph * 1.3) * 10; vy = 56 * m.z; break;
        case 'petal': vx = -38 * m.z + Math.sin(m.ph * 2) * 22; vy = 32 * m.z; break;
        case 'ash': vx = -16 * m.z + Math.sin(m.ph) * 6; vy = 22 * m.z; break;
        case 'firefly': vx = Math.sin(m.ph * 0.9) * 22; vy = Math.cos(m.ph * 1.3) * 16; break;
        default: vx = Math.sin(m.ph * 0.7) * 10; vy = -8 * m.z;
      }
      m.x += vx * rdt; m.y += vy * rdt;
      const sx = (((m.x - cam.x * m.z * 0.6) % W) + W) % W - 50;
      const sy = (((m.y - cam.y * m.z * 0.3) % H) + H) % H - 50;
      const tw = Math.abs(Math.sin(m.ph * (kind === 'firefly' ? 0.8 : 1.3)));
      if (glowing) {
        const r = (kind === 'firefly' ? 9 : 6) * m.z * (0.6 + tw * 0.6);
        c.globalAlpha = (kind === 'firefly' ? tw * tw : 0.35 + tw * 0.5) * Math.min(1, m.z);
        c.drawImage(spr, sx - r, sy - r, r * 2, r * 2);
      } else if (kind === 'petal') {
        c.globalAlpha = 0.45 + 0.4 * tw;
        c.beginPath(); c.ellipse(sx, sy, 4 * m.z, 2 * m.z * (0.4 + tw * 0.6), m.ph, 0, TAU); c.fill();
      } else {
        c.globalAlpha = (0.25 + 0.45 * tw) * Math.min(1, m.z);
        c.beginPath(); c.arc(sx, sy, (kind === 'snow' ? 2.4 : 1.6) * m.z, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
};
