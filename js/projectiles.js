'use strict';
// Arrows, shuriken, feathers, foxfire, rocks, slash waves, shockwaves, tornadoes and markers.
class Projectile {
  constructor(type, x, y, vx, vy, o = {}) {
    this.type = type; this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.px = x; this.py = y;
    this.owner = o.owner || 'enemy';
    this.dmg = o.dmg || 1;
    this.grav = o.grav || 0;
    this.r = o.r || 4;
    this.life = o.life || 6;
    this.deflect = o.deflect !== undefined ? o.deflect : true; // true | false | 'heavy'
    this.shooter = o.shooter || null;
    this.homing = o.homing || 0;
    this.speed = Math.hypot(vx, vy);
    this.dead = false; this.stuck = false; this.rot = Math.atan2(vy, vx);
    this.kb = o.kb || 420;
    this.src = o.src || 'a projectile';
    this.w = o.w || 0; this.h = o.h || 0;
    this.groundY = o.groundY || 0;
    this.onExpire = o.onExpire || null;
    this.age = 0; this.bladeCD = 0; this.target = null; this.hitCD = 0;
  }

  update(dt) {
    this.age += dt;
    if (this.stuck) { this.life -= dt; if (this.life <= 0) this.dead = true; return; }
    this.life -= dt; this.bladeCD -= dt; this.hitCD -= dt;
    if (this.life <= 0) {
      this.dead = true;
      if (this.onExpire) this.onExpire(this);
      if (this.type === 'foxfire') FX.fire(this.x, this.y, 6);
      return;
    }
    if (this.type === 'marker') return;
    if (this.type === 'tornado') return this.updateTornado(dt);
    this.px = this.x; this.py = this.y;
    // homing
    const tgt = this.owner === 'enemy' ? G.player : this.target;
    if (this.homing && tgt && !tgt.dead) {
      const want = Math.atan2(tgt.y - 10 - this.y, tgt.x - this.x);
      const cur = Math.atan2(this.vy, this.vx);
      const na = cur + clamp(angDiff(cur, want), -this.homing * dt, this.homing * dt);
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }
    this.vy += this.grav * dt;
    if (G.wind && this.type !== 'shock' && this.type !== 'wave') this.vx += G.wind * 1.5 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.type !== 'shuriken' && this.type !== 'rock') this.rot = Math.atan2(this.vy, this.vx);
    else this.rot += dt * (this.type === 'rock' ? 4 : 22) * sgn(this.vx);
    const L = G.level;

    if (this.type === 'shock') {
      const front = this.x + sgn(this.vx) * this.w / 2;
      if (L.solidAt(front, this.groundY - 10) || !L.solidAt(front, this.groundY + 6)) { this.dead = true; FX.dust(this.x, this.groundY, 6); return; }
      if (Math.random() < 0.5) FX.debris(this.x, this.groundY - 4, 1, L.pal.rockLight);
    } else if (this.type === 'foxfire') {
      if (Math.random() < 0.6) FX.fire(this.x, this.y, 1, this.owner === 'player' ? '#ffd27f' : '#7fd8ff', 30);
    }

    if (this.type !== 'shock' && L.solidAt(this.x, this.y)) { this.hitTerrain(); return; }
    if (this.y > L.height + 200) { this.dead = true; return; }

    if (this.owner === 'enemy') {
      const p = G.player;
      if (p.dead) return;
      if (!p.rag && !p.thrown && this.deflect !== false && this.bladeCD <= 0) {
        const sw = p.sword;
        const touch = pointSegDist(this.x, this.y, sw.bx, sw.by, sw.tx, sw.ty) < this.r + 4 ||
          segSeg(this.px, this.py, this.x, this.y, sw.bx, sw.by, sw.tx, sw.ty) >= 0;
        if (touch) { this.onBlade(p); if (this.dead || this.owner === 'player') return; }
      }
      const hb = this.type === 'shock'
        ? { x: this.x - this.w / 2, y: this.groundY - this.h, w: this.w, h: this.h }
        : grow(p.hurtbox(), this.r);
      const hit = this.type === 'shock' ? rectsOverlap(hb, p.hurtbox()) : segRect(this.px, this.py, this.x, this.y, hb) >= 0;
      if (hit && this.hitCD <= 0) {
        if (p.hurt(this.dmg, sgn(this.vx) * this.kb, this.type === 'shock' ? -700 : -320, this.src)) {
          if (this.type === 'shock' || this.type === 'wave') this.hitCD = 1; else this.dead = true;
        }
      }
    } else {
      for (const e of G.enemies) {
        if (e.dead || !e.hittable) continue;
        for (const hb of e.hurtboxes()) {
          if (segRect(this.px, this.py, this.x, this.y, grow(hb, this.r)) >= 0) {
            const sp = Math.hypot(this.vx, this.vy) || 1;
            e.takeHit(this.dmg, this.vx / sp, this.vy / sp, this.x, this.y, 900, this);
            FX.spark(this.x, this.y, 10, null, TAU, 400);
            this.dead = true;
            if (this.type === 'rock') FX.debris(this.x, this.y, 10, G.level.pal.rockLight);
            return;
          }
        }
      }
    }
  }

  updateTornado(dt) {
    this.x += this.vx * dt;
    const L = G.level;
    if (L.solidAt(this.x + sgn(this.vx) * this.w / 2, this.groundY - 20)) this.vx = -this.vx;
    if (Math.random() < 0.8) FX.add({ t: 'dust', x: this.x + rand(-this.w / 2, this.w / 2), y: this.groundY - rand(0, this.h), vx: rand(-200, 200), vy: rand(-200, -50), life: 0.4, max: 0.4, col: 'rgba(230,240,255,0.35)', grav: 0, size: rand(4, 10) });
    const p = G.player;
    const r = { x: this.x - this.w / 2, y: this.groundY - this.h, w: this.w, h: this.h };
    if (!p.dead && rectsOverlap(r, p.hurtbox())) {
      if (!p.rag && p.invuln <= 0 && p.dashT <= 0) p.hurt(1, sgn(p.x - this.x) * 300, -1150, 'a tornado');
      else if (!p.rag && p.dashT <= 0) { p.vy = Math.min(p.vy, -500); p.vx += (this.x - p.x) * 2 * dt; }
    }
  }

  onBlade(p) {
    const sw = p.sword;
    const tipV = Math.abs(sw.av) * (sw.r + sw.len);
    this.bladeCD = 0.12;
    if (this.deflect === 'heavy' && tipV < 950) {
      sw.av += sgn(sw.av || 1) * -14;
      Sound.clang(0.6); FX.spark(this.x, this.y, 8, null, TAU, 300);
      FX.text(this.x, this.y - 20, 'TOO HEAVY', '#ffb0a0', 14);
      return;
    }
    let nvx, nvy;
    let spd = Math.max(Math.hypot(this.vx, this.vy) * 1.25, 720);
    if (tipV > 300) {
      const d = sgn(sw.av);
      nvx = -Math.sin(sw.ang) * d; nvy = Math.cos(sw.ang) * d;
    } else {
      // passive block: weak reflection off blade
      const bx = sw.tx - sw.bx, by = sw.ty - sw.by, bl = Math.hypot(bx, by) || 1;
      const nx = -by / bl, ny = bx / bl;
      const vd = this.vx * nx + this.vy * ny;
      nvx = this.vx - 2 * vd * nx; nvy = this.vy - 2 * vd * ny;
      const l = Math.hypot(nvx, nvy) || 1; nvx /= l; nvy /= l;
      spd *= 0.55;
    }
    // return to sender
    const sh = this.shooter;
    if (sh && !sh.dead && sh.hittable !== false && tipV > 450) {
      const tx = sh.x - this.x, ty = sh.y - 10 - this.y, tl = Math.hypot(tx, ty) || 1;
      if ((nvx * tx + nvy * ty) / tl > 0.35) { nvx = tx / tl; nvy = ty / tl; this.target = sh; this.homing = 5; }
    }
    this.vx = nvx * spd; this.vy = nvy * spd;
    this.owner = 'player';
    this.dmg = this.type === 'rock' ? 6 : this.dmg * 2;
    this.grav *= 0.25; this.life = 2.5;
    if (!this.target) this.homing = 0;
    Sound.tink(); if (this.type === 'rock') Sound.clang(1);
    FX.parryBurst(this.x, this.y, 0.4);
    FX.spark(this.x, this.y, 14, Math.atan2(nvy, nvx), 1.2, 600);
    FX.text(this.x, this.y - 18, 'DEFLECT!', '#9ff3ff', 16);
    G.hitstop = Math.max(G.hitstop, 0.03);
  }

  hitTerrain() {
    switch (this.type) {
      case 'arrow': case 'feather': case 'shuriken':
        this.stuck = true; this.life = 3;
        this.x -= this.vx * 0.006; this.y -= this.vy * 0.006;
        Sound.thunk(); FX.spark(this.x, this.y, 3, null, TAU, 150, '#ddd');
        break;
      case 'rock':
        this.dead = true; Sound.boom(0.4); FX.debris(this.x, this.y, 14, G.level.pal.rockLight); FX.dust(this.x, this.y, 8);
        G.shake(5);
        break;
      default:
        this.dead = true; FX.fire(this.x, this.y, 8, this.type === 'foxfire' ? '#7fd8ff' : '#ffffff'); FX.dust(this.x, this.y, 4);
    }
  }

  draw(ctx) {
    const pl = this.owner === 'player';
    switch (this.type) {
      case 'arrow': {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.strokeStyle = pl ? '#9ff3ff' : '#d8c8a0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(2, 0); ctx.stroke();
        ctx.fillStyle = '#c8d0d8'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -3); ctx.lineTo(-1, 3); ctx.fill();
        ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-20, -4); ctx.lineTo(-18, 0); ctx.lineTo(-20, 4); ctx.fill();
        ctx.restore();
        break;
      }
      case 'shuriken': {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillStyle = pl ? '#9ff3ff' : '#c8d0d8';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8, rr = i % 2 ? 2.5 : 8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'feather': {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillStyle = pl ? '#7fe8ff' : '#111118';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(0, -5, -12, -1); ctx.lineTo(-12, 1); ctx.quadraticCurveTo(0, 5, 10, 0); ctx.fill();
        ctx.strokeStyle = pl ? '#fff' : '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'foxfire': {
        const col = pl ? '255,200,110' : '127,216,255';
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, this.r * 2.2);
        gr.addColorStop(0, `rgba(255,255,255,0.95)`); gr.addColorStop(0.35, `rgba(${col},0.8)`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rock': {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillStyle = pl ? '#7fb8c8' : G.level.pal.rockLight;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7, rr = this.r * (0.8 + hash2(i, 3) * 0.35); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(3, 4, this.r * 0.5, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'wave': {
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(sgn(this.vx), 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = pl ? 'rgba(160,240,255,0.85)' : 'rgba(255,90,90,0.85)';
        ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(22, 0, -6, 26); ctx.quadraticCurveTo(8, 0, -6, -26); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        break;
      }
      case 'shock': {
        const k = 0.75 + Math.sin(this.age * 40) * 0.25;
        ctx.fillStyle = `rgba(255,200,120,${0.7 * k})`;
        ctx.beginPath();
        ctx.moveTo(this.x - this.w / 2, this.groundY);
        ctx.quadraticCurveTo(this.x, this.groundY - this.h * 1.6 * k, this.x + this.w / 2, this.groundY);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(this.x - this.w / 2, this.groundY - 3, this.w, 3);
        break;
      }
      case 'tornado': {
        ctx.strokeStyle = 'rgba(230,240,255,0.5)'; ctx.lineWidth = 3;
        for (let i = 0; i < 9; i++) {
          const yy = this.groundY - (i / 8) * this.h, ww = this.w * (0.35 + (i / 8) * 0.75);
          const off = Math.sin(this.age * 6 + i) * 10;
          ctx.beginPath(); ctx.ellipse(this.x + off, yy, ww / 2, 8, 0, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'marker': {
        const k = 1 - this.life / this.max0;
        ctx.strokeStyle = `rgba(255,60,60,${0.3 + k * 0.6})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y - 700); ctx.stroke();
        ctx.fillStyle = `rgba(255,60,60,${0.4 + k * 0.5})`;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 16 * (0.5 + k), 4, 0, 0, TAU); ctx.fill();
        break;
      }
    }
  }
}

function makeMarker(x, y, delay, onExpire) {
  const m = new Projectile('marker', x, y, 0, 0, { life: delay, deflect: false, onExpire });
  m.max0 = delay;
  return m;
}
