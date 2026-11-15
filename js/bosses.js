'use strict';
// ================================================================== Boss base
class Boss extends Actor {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.isBoss = true; this.p2 = false; this.lastAtk = ''; this.spd = 1; this.phaseLine = 'Enough.';
  }
  get S() { return this.spd * (this.p2 ? 1.25 : 1); }
  pickAtk(o) {
    let a = pick(o);
    if (a === this.lastAtk) a = pick(o);
    if (a === this.lastAtk) a = pick(o);
    this.lastAtk = a;
    return a;
  }
  takeHit(dmg, dx, dy, hx, hy, speed, proj) {
    super.takeHit(dmg, dx, dy, hx, hy, speed, proj);
    if (!this.dead && !this.p2 && this.hp <= this.maxHp / 2 && this.state !== 'phase') this.enterPhase();
  }
  enterPhase() {
    this.setState('phase');
    this.hittable = false;
    for (const b of this.blades) { b.active = false; b.cancelled = true; }
    G.shake(12); FX.ring(this.x, this.y, 10, 260, '#ff6060', 0.6, 6);
    FX.text(this.x, this.y - this.h / 2 - 30, this.phaseLine, '#ffffff', 16, { bubble: true, life: 1.6, vy: -20 });
    this.phaseSound();
  }
  phaseSound() { Sound.roar(); }
  kicked(dir) { this.vx += dir * 160; } // bosses barely budge
  die(vx, vy) {
    if (this.dead) return;
    this.dead = true; this.remove = true;
    G.addCorpse(this, vx * 0.5, Math.min(vy, -500) * 0.6);
    FX.blood(this.x, this.y, 70, vx || 1, vy || -1, this.bloodCol);
    if (Math.hypot(G.player.x - this.x, G.player.y - this.y) < 260) FX.screenSplat(5, this.bloodCol);
    FX.ring(this.x, this.y, 20, 400, '#ffffff', 0.8, 8);
    Sound.gong(); G.slowmo(0.2, 1.6); G.shake(18);
    G.onBossDefeated(this);
  }
}

// ================================================================== Ronin / Shogun
const RONIN_COMBO = [
  { from: -2.5, to: 1.2, w: 0.42, d: 0.13, lunge: 220 },
  { from: 1.2, to: -1.8, w: 0.24, d: 0.12, lunge: 180 },
  { from: -0.35, to: 0.05, w: 0.32, d: 0.16, lunge: 780, thrust: true },
];

class Ronin extends Boss {
  constructor(x, gy, cfg = {}) {
    const s = cfg.s || 1.15;
    super(x, gy - 27 * s, 24 * s, 54 * s);
    this.s = s; this.cfg = cfg;
    this.name = cfg.name || 'KAITO'; this.title = cfg.title || 'the Wandering Blade'; this.kanji = cfg.kanji || '浪人';
    this.hp = this.maxHp = cfg.hp || 44; this.spd = cfg.spd || 1;
    this.style = cfg.style || STYLES.ronin;
    this.bladeLen = cfg.bladeLen || 78;
    this.breakAt = cfg.rain ? 5 : 4;
    this.phaseLine = cfg.phaseLine || 'Enough games.';
    this.blade = mkBlade({ r: 3.5, dmg: 1 }); this.blades = [this.blade];
    this.la = 1.2; this.reach = 0; this.crouch = 0; this.combo = 0; this.recT = 0.6; this.stagT = 1;
    this.dashN = 0; this.glinted = false; this.thrown = false; this.glow = null;
    this.hand = { x, y: gy }; this.wang = 0;
    this.setState('intro');
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, adx = Math.abs(dx), S = this.S;
    const face = () => { this.facing = dx >= 0 ? 1 : -1; };
    let tla = -0.5, lsp = 14, move = 0, mspd = 0, ctrl = true;
    this.blade.active = false; this.glow = null; this.crouch = 0; this.reach = 0; this.lean = 0.05;
    switch (this.state) {
      case 'intro': face(); tla = 1.2; if (this.st > 1.6) this.setState('idle'); break;
      case 'phase':
        tla = -1.57; lsp = 6; this.glow = '#ff4040';
        if (Math.random() < 0.4) FX.fire(this.x + rand(-20, 20), this.y + rand(-30, 30), 1, '#ff5040');
        if (this.st > 1.6) { this.p2 = true; this.hittable = true; this.setState('idle'); }
        break;
      case 'idle':
        face(); tla = -0.5; this.resetBlade();
        if (adx > 170) { move = this.facing; mspd = 120 * S; }
        if (this.st > 0.5 / S) this.choose();
        break;
      case 'iaiW': {
        const w = (this.dashN > 0 ? 0.36 : 0.78) / S;
        tla = 2.7; lsp = 10; this.crouch = 8;
        if (this.st < w * 0.6) face();
        if (!this.glinted && this.st > w - 0.32) { this.glinted = true; FX.glint(this.pose.head.x + this.facing * 12, this.pose.head.y + 4, '#ffffff', 40); Sound.shing(); }
        if (this.st >= w) {
          startSwing(this.blade); this.blade.guardBreak = true;
          const A = G.level.arena;
          this.dashTo = clamp(p.x + this.facing * 240, (A.c0 + 2) * T, (A.c1 - 3) * T);
          if (Math.abs(this.dashTo - this.x) < 200) this.dashTo = this.x + this.facing * 240;
          this.setState('iai'); Sound.dash();
        }
        break;
      }
      case 'iai': {
        ctrl = false; tla = 0.05; lsp = 40; this.reach = 6; this.lean = 0.4;
        this.vx = this.facing * 1450 * Math.min(1.25, S);
        this.blade.active = true;
        if (Math.random() < 0.6) FX.dust(this.x, this.footY(), 1, 'rgba(255,255,255,0.4)', 40);
        const done = (this.facing > 0 ? this.x >= this.dashTo : this.x <= this.dashTo) || this.hitWall !== 0 || this.st > 0.7;
        if (done) {
          this.vx = this.facing * 250; this.blade.guardBreak = false; this.dashN++;
          const maxD = this.p2 ? (this.cfg.rain ? 3 : 2) : 1;
          if (this.dashN < maxD) { this.facing = -this.facing; this.glinted = false; this.setState('iaiW'); }
          else { this.dashN = 0; this.recT = 0.75 / S; this.setState('recover'); }
        }
        break;
      }
      case 'chase':
        face(); tla = -0.6; move = this.facing; mspd = 330 * S;
        if (adx < 95 || this.st > 1.2) { this.combo = 0; this.setState('cW'); }
        break;
      case 'cW': {
        const q = RONIN_COMBO[this.combo];
        tla = q.from; lsp = 18;
        if (this.combo === 0 || this.st < 0.08) face();
        if (this.st >= q.w / S) { startSwing(this.blade); this.la = q.from; Sound.swing(); this.setState('c'); }
        break;
      }
      case 'c': {
        ctrl = false;
        const q = RONIN_COMBO[this.combo], k = Math.min(1, this.st / q.d);
        tla = null; this.la = lerp(q.from, q.to, easeOut(k)); this.blade.active = true; this.lean = 0.3;
        if (q.thrust) this.reach = 6 * k;
        this.vx = this.st < q.d * 0.7 ? this.facing * q.lunge : this.vx * 0.9;
        if (k >= 1) {
          this.combo++;
          if (this.combo < RONIN_COMBO.length) this.setState('cW');
          else { this.recT = 0.8 / S; this.setState('recover'); }
        }
        break;
      }
      case 'counter':
        face(); tla = 0.25; lsp = 18; this.glow = '#5fd0ff'; this.crouch = 4;
        if (Math.random() < 0.8) FX.fire(this.x + rand(-26, 26) * this.s, this.y + rand(-10, 30) * this.s, 1, '#5fd0ff', 50);
        if (this.st > 1.5) this.setState('idle');
        break;
      case 'counterCut': {
        ctrl = false;
        const d = 0.24, k = Math.min(1, this.st / d);
        tla = null; this.la = lerp(-3.1, 2.3, easeOut(k)); this.blade.active = true; this.reach = 6; this.glow = '#5fd0ff'; this.lean = 0.35;
        this.vx = this.st < 0.12 ? this.facing * 650 : this.vx * 0.85;
        if (k >= 1) { this.resetBlade(); this.recT = 0.55; this.setState('recover'); }
        break;
      }
      case 'jumpBack':
        ctrl = false; tla = -1.2;
        if (!this.thrown && this.vy > -80) { this.thrown = true; this.throwStars(); }
        if (this.grounded && this.st > 0.25) { this.vx = 0; this.setState('idle'); }
        break;
      case 'waveW':
        face(); tla = -2.4; lsp = 12;
        if (this.st > 0.5 / S) { startSwing(this.blade); this.la = -2.4; this.setState('wave'); Sound.swing(); }
        break;
      case 'wave': {
        ctrl = false;
        const k = Math.min(1, this.st / 0.12);
        tla = null; this.la = lerp(-2.4, 1.0, easeOut(k)); this.blade.active = true;
        if (k >= 1) {
          G.projectiles.push(new Projectile('wave', this.x + this.facing * 34, this.footY() - 28, this.facing * 650, 0, { r: 18, shooter: this, life: 3, src: this.name + "'s slash wave" }));
          if (this.cfg.rain) G.projectiles.push(new Projectile('wave', this.x - this.facing * 34, this.footY() - 28, -this.facing * 650, 0, { r: 18, shooter: this, life: 3, src: this.name + "'s slash wave" }));
          this.recT = 0.5 / S; this.setState('recover');
        }
        break;
      }
      case 'rainW':
        face(); tla = -1.57; lsp = 8; this.glow = '#ff5050';
        if (this.st > 0.8 && !this.thrown) { this.thrown = true; this.arrowRain(); }
        if (this.st > 1.2) this.setState('idle');
        break;
      case 'recover': tla = 1.0; lsp = 8; if (this.st > this.recT) this.setState('idle'); break;
      case 'stagger': tla = 1.5; lsp = 4; this.crouch = 7; if (this.st > this.stagT) this.setState('idle'); break;
    }
    if (tla !== null) this.la += (tla - this.la) * Math.min(1, dt * lsp);
    if (ctrl) this.vx = approach(this.vx, move * mspd, (this.grounded ? 1600 : 400) * dt);
    this.physics(dt);
    this.phase += Math.abs(this.vx) * dt * 0.045;
    // weapon geometry
    const sh = this.shoulder(), s = this.s;
    const rr = (15 + this.reach) * s;
    const wa = keepAboveGround(this.facing > 0 ? this.la : Math.PI - this.la, sh.y, rr + this.bladeLen, this.footY());
    const c = Math.cos(wa), sn = Math.sin(wa);
    const hx = sh.x + c * rr, hy = sh.y + sn * rr;
    this.hand.x = hx; this.hand.y = hy; this.wang = wa;
    setBlade(this.blade, hx + c * 9 * s, hy + sn * 9 * s, hx + c * this.bladeLen, hy + sn * this.bladeLen);
    bladeAttack(this, this.blade);
    const hip = this.pose.hip;
    standPose(this.pose, {
      x: this.x, footY: this.footY(), facing: this.facing, s, phase: this.phase,
      run: this.grounded ? Math.min(1.2, Math.abs(this.vx) / 200) : 0, air: !this.grounded, vy: this.vy,
      lean: this.lean, crouch: this.crouch, hF: this.hand,
      hB: this.state === 'iaiW' ? { x: hip.x + this.facing * 5 * s, y: hip.y - 2 * s } : { x: hx - c * 6 * s, y: hy - sn * 6 * s },
    });
  }
  choose() {
    const adx = Math.abs(G.player.x - this.x);
    const o = adx < 230 ? ['chase', 'chase', 'counter', 'jumpBack', 'iai'] : ['iai', 'iai', 'jumpBack', 'chase'];
    if (this.p2) o.push('waveW', 'iai');
    if (this.cfg.rain) o.push('rainW', adx > 300 ? 'rainW' : 'chase');
    let a = this.pickAtk(o);
    if (['counter', 'iai', 'chase', 'jumpBack', 'waveW', 'rainW'].includes(G.devForce)) a = G.devForce;
    if (a === 'iai') { this.dashN = 0; this.glinted = false; this.setState('iaiW'); }
    else if (a === 'jumpBack') { this.vy = -700; this.vx = -this.facing * 380; this.thrown = false; this.setState('jumpBack'); }
    else if (a === 'rainW') { this.thrown = false; this.setState('rainW'); }
    else if (a === 'counter') this.onCounterStart();
    else this.setState(a);
  }
  onCounterStart() {
    this.setState('counter');
    Sound.stance();
    FX.ring(this.x, this.y, 10, 160 * this.s, '#5fd0ff', 0.5, 5);
    FX.ring(this.x, this.footY(), 4, 120 * this.s, '#bff2ff', 0.4, 3);
    FX.text(this.x, this.y - this.h / 2 - 96 * this.s, 'COUNTER STANCE', '#7fe0ff', 20, { life: 1.1, vy: -14 });
  }
  throwStars() {
    const p = G.player, n = this.p2 ? 5 : 3, sh = this.shoulder();
    const base = Math.atan2(p.y - 8 - sh.y, p.x - sh.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.2;
      G.projectiles.push(new Projectile('shuriken', sh.x, sh.y, Math.cos(a) * 640, Math.sin(a) * 640, { r: 7, shooter: this, src: this.name + "'s shuriken" }));
    }
    Sound.shoot();
  }
  arrowRain() {
    const A = G.level.arena, x0 = (A.c0 + 2) * T, x1 = (A.c1 - 3) * T, gy = A.top * T;
    const xs = [G.player.x, G.player.x + rand(-70, 70)];
    for (let i = 0; i < (this.p2 ? 11 : 8); i++) xs.push(rand(x0, x1));
    xs.forEach((x, i) => G.projectiles.push(makeMarker(x, gy, 0.9 + i * 0.06, (m) => {
      G.projectiles.push(new Projectile('arrow', m.x, G.viewTop - 40, rand(-20, 20), 1000, { grav: 300, src: 'the arrow rain', life: 3 }));
    })));
    Sound.shing();
    FX.text(this.x, this.y - this.h / 2 - 30, 'ARCHERS!', '#fff', 15, { bubble: true, life: 1.2, vy: -20 });
  }
  triggerCounter() {
    this.facing = G.player.x >= this.x ? 1 : -1;
    startSwing(this.blade); this.blade.dmg = this.broken ? 1 : 2; this.blade.parryable = false; this.blade.guardBreak = true; this.la = -3.1;
    this.setState('counterCut');
    Sound.counterCut(); Sound.clang(1);
    FX.text(this.x, this.y - this.h / 2 - 26, 'COUNTER!', '#5fd0ff', 26);
    FX.glint(this.hand.x, this.hand.y, '#5fd0ff', 48);
    FX.ring(this.x, this.y, 10, 200 * this.s, '#5fd0ff', 0.4, 6);
    G.flash = Math.max(G.flash, 0.18); G.zoomKick = Math.max(G.zoomKick, 0.05);
    G.slowmo(0.4, 0.25);
  }
  // the stance has to be unmissable: danger circle on the ground, aura, light pillars, outline, warning badge
  drawCounterStance(ctx) {
    const t = G.time, pulse = 0.5 + 0.5 * Math.sin(t * 16), s = this.s;
    const gy = this.footY(), R = 30 * s + this.bladeLen + 24;
    G.edgeTint = `rgba(70,190,255,${0.16 + pulse * 0.08})`;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(this.x, gy); ctx.scale(1, 0.22);
    const zg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    zg.addColorStop(0, 'rgba(95,208,255,0.05)'); zg.addColorStop(0.75, `rgba(95,208,255,${0.18 + pulse * 0.12})`); zg.addColorStop(1, 'rgba(95,208,255,0)');
    ctx.fillStyle = zg; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(140,225,255,${0.6 + pulse * 0.4})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 120; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const ar = this.h * 1.2;
    const ag = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, ar);
    ag.addColorStop(0, `rgba(95,208,255,${0.4 + pulse * 0.25})`); ag.addColorStop(1, 'rgba(95,208,255,0)');
    ctx.fillStyle = ag; ctx.fillRect(this.x - ar, this.y - ar, ar * 2, ar * 2);
    for (let i = 0; i < 7; i++) {
      const ph = (t * 1.4 + i / 7) % 1, px = this.x + Math.sin(i * 2.3) * R * 0.8;
      ctx.fillStyle = `rgba(160,235,255,${(1 - ph) * 0.6})`;
      ctx.fillRect(px - 1.5, gy - ph * 140 * s - 26, 3, 26);
    }
    ctx.restore();
  }
  drawCounterBadge(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 16), s = this.s;
    const bx = this.pose.head.x, by = this.pose.head.y - 46 * s - Math.sin(G.time * 4) * 3;
    ctx.save();
    ctx.shadowColor = '#5fd0ff'; ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(6,28,42,0.88)'; ctx.strokeStyle = '#8fe6ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, by, 19 + pulse * 3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8f6ff'; ctx.font = '800 24px "Shippori Mincho B1", serif';
    ctx.fillText('構', bx, by + 1);
    ctx.font = '900 12px "Zen Kaku Gothic New", system-ui, sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText('COUNTER - DON\'T STRIKE', bx, by + 34); ctx.fillStyle = '#8fe6ff'; ctx.fillText('COUNTER - DON\'T STRIKE', bx, by + 34);
    ctx.restore();
  }
  takeHit(dmg, dx, dy, hx, hy, speed, proj) {
    if (this.state === 'counter' && !proj) { this.triggerCounter(); FX.spark(hx, hy, 14, null, TAU, 500, '#bff6ff'); return; }
    super.takeHit(dmg, dx, dy, hx, hy, speed, proj);
  }
  onGuardHit() { if (this.state === 'counter') this.triggerCounter(); }
  // the answer to the counter stance: you can't cut him, but you can kick him off balance
  kicked(dir) {
    if (this.state === 'counter') {
      this.vx = dir * 380; this.stagT = 1.2; this.setState('stagger');
      FX.text(this.x, this.y - this.h / 2 - 30, 'GUARD BROKEN!', '#ffd76a', 22);
      FX.ring(this.x, this.y, 10, 160, '#ffd76a', 0.4, 5);
      G.slowmo(0.3, 0.3);
    } else this.vx += dir * 200;
  }
  resetBlade() { this.blade.dmg = 1; this.blade.parryable = true; this.blade.guardBreak = false; }
  onShatter() {
    this.resetBlade(); this.dashN = 0; this.stagT = 2.2; this.setState('stagger');
    FX.text(this.x, this.y - this.h / 2 - 70, this.cfg.rain ? 'IMPOSSIBLE...' : 'My blade...!', '#fff', 14, { bubble: true, life: 1.6, vy: -20 });
  }
  onParried() { this.resetBlade(); this.dashN = 0; this.stagT = 1.1; this.vx = -this.facing * 300; this.setState('stagger'); }
  onBlocked() { this.resetBlade(); this.dashN = 0; this.recT = 0.45; this.setState('recover'); }
  draw(ctx) {
    this.drawShadow(ctx);
    const countering = this.state === 'counter';
    if (countering) this.drawCounterStance(ctx);
    if (this.state === 'counterCut') {
      // big blue crescent following the counter-cut
      const sh = this.shoulder(), R = (21 * this.s + this.bladeLen) * 0.85;
      const a0 = this.facing > 0 ? -3.1 : Math.PI + 3.1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(sh.x, sh.y, R, a0, this.wang, this.facing < 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,250,255,0.8)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, R, a0, this.wang, this.facing < 0); ctx.stroke();
      ctx.restore();
    }
    if (this.p2) {
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.h);
      gr.addColorStop(0, 'rgba(255,40,40,0.25)'); gr.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(this.x - this.h, this.y - this.h, this.h * 2, this.h * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (countering) {
      // glowing blue silhouette outline
      const blue = solidStyle(this.style, '#7fe0ff');
      ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * Math.sin(G.time * 16) * 0.5 + 0.2;
      for (const [ox, oy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5]]) {
        ctx.save(); ctx.translate(ox, oy); figBody(ctx, this.pose, blue, this.facing, true, 0, null); ctx.restore();
      }
      ctx.restore();
    }
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    drawKatana(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.s, this.style, this.glow);
    drawCracks(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.cracks, this.broken, this.s);
    if (countering) this.drawCounterBadge(ctx);
    if (this.state === 'stagger') drawStars(ctx, this.pose.head.x, this.pose.head.y - 16 * this.s, G.time, 14);
  }
}

// ================================================================== Oni
class Oni extends Boss {
  constructor(x, gy) {
    const s = 2.6;
    super(x, gy - 27 * s, 64, 54 * s);
    this.s = s; this.name = 'GŌKI'; this.title = 'Red Oni of the Pass'; this.kanji = '鬼';
    this.hp = this.maxHp = 72; this.style = STYLES.oni; this.bloodCol = '#4a0c0c';
    this.phaseLine = 'GRAAAAAH!!';
    this.club = mkBlade({ r: 11, dmg: 2, heavy: true }); this.blades = [this.club];
    this.clubLen = 132; this.curLen = 132; this.la = 0.9; this.crouch = 0; this.lean = 0;
    this.solidBody = true; this.turnT = 0; this.idleR = 0.4; this.wave2 = -1; this.stuckT = 1; this.recT = 0.6; this.dazeT = 1.6;
    this.hand = { x, y: gy }; this.wang = 0;
    this.setState('intro');
  }
  hurtboxes() { return [{ x: this.x - this.w / 2, y: this.y - this.h / 2 + 8, w: this.w, h: this.h - 8 }]; }
  phaseSound() { Sound.roar(); }
  kicked() { FX.text(this.x, this.y - this.h / 2 - 20, 'HAH! TICKLES.', '#ffb0a0', 16); }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, adx = Math.abs(dx), S = this.S;
    let tla = 0.9, lsp = 8, move = 0, mspd = 0, ctrl = true;
    this.club.active = false; this.crouch = 0; this.lean = 0.05;
    const gy = this.footY();
    switch (this.state) {
      case 'intro':
        tla = -2.2; lsp = 4;
        if (this.st > 0.4 && !this.roared) { this.roared = true; Sound.roar(); G.shake(12); }
        if (this.st > 2.0) this.setState('idle');
        break;
      case 'phase':
        tla = -2.4; this.hittable = false;
        if (Math.random() < 0.5) FX.smoke(this.x + rand(-30, 30), this.y - 60, 1, 'rgba(255,255,255,0.4)');
        if (this.st > 1.8) { this.p2 = true; this.hittable = true; this.setState('idle'); }
        break;
      case 'idle': {
        const want = dx >= 0 ? 1 : -1;
        if (want !== this.facing) { this.turnT += dt; if (this.turnT > 0.25 / S) { this.facing = want; this.turnT = 0; } }
        else this.turnT = 0;
        if (adx > 150) { move = this.facing; mspd = 85 * S; }
        if (this.st > (0.9 + this.idleR) / S) this.choose();
        break;
      }
      case 'slamW':
        tla = -2.5; lsp = 6; this.lean = -0.15;
        if (this.st >= 0.85 / S) { startSwing(this.club); this.la = -2.5; this.setState('slam'); Sound.swing(); }
        break;
      case 'slam': {
        ctrl = false;
        const k = Math.min(1, this.st / 0.13);
        tla = null; this.la = lerp(-2.5, 0.8, easeIn(k)); this.club.active = true; this.lean = 0.3;
        if (k >= 1) { this.impact(this.club.bx, 1); this.wave2 = this.p2 ? 0.4 : -1; this.stuckT = this.p2 ? 0.9 : 1.1; this.setState('stuck'); }
        break;
      }
      case 'stuck':
        tla = 0.8; lsp = 20; this.lean = 0.3; this.crouch = 6;
        if (this.wave2 > 0) { this.wave2 -= dt; if (this.wave2 <= 0) this.impact(this.club.bx, 1.4); }
        if (this.st > this.stuckT) this.setState('idle');
        break;
      case 'sweepW':
        tla = 2.7; lsp = 8; this.crouch = 10; this.lean = -0.1;
        if (this.st >= 0.75 / S) { startSwing(this.club); this.la = 2.7; this.setState('sweep'); Sound.swing(); }
        break;
      case 'sweep': {
        ctrl = false;
        const k = Math.min(1, this.st / 0.3);
        tla = null; this.la = lerp(2.7, 0.2, easeOut(k)); this.club.active = true; this.crouch = 10;
        this.vx = this.facing * 120;
        if (Math.random() < 0.6) FX.dust(this.club.bx, gy, 1, 'rgba(255,220,180,0.5)', 120);
        if (k >= 1) { this.recT = 0.7 / S; this.setState('recover'); }
        break;
      }
      case 'chargeW':
        tla = 0.4; this.crouch = 12; this.lean = 0.35;
        if (this.st < 0.2) this.facing = dx >= 0 ? 1 : -1;
        if (Math.random() < 0.3) FX.dust(this.x - this.facing * 20, gy, 1);
        if (this.st >= 0.85 / S) { startSwing(this.club); this.setState('charge'); Sound.roar(); this.bodyHit = false; }
        break;
      case 'charge': {
        ctrl = false; tla = 0.4; this.crouch = 10; this.lean = 0.45; this.club.active = true;
        this.vx = this.facing * 640 * Math.min(1.3, S);
        if (Math.random() < 0.5) FX.dust(this.x - this.facing * 30, gy, 2);
        if (!this.bodyHit && rectsOverlap(this.hurtboxes()[0], p.hurtbox()) && p.hurt(2, this.facing * 1000, -650, this.name)) this.bodyHit = true;
        if (this.hitWall) {
          G.shake(18); Sound.boom(1);
          FX.debris(this.x + this.facing * 40, this.y - 40, 16, G.level.pal.rockLight);
          FX.text(this.x, this.y - this.h / 2 - 20, 'BONK', '#ffe14a', 22);
          this.rockFall(this.p2 ? 6 : 3);
          this.dazeT = this.p2 ? 1.4 : 1.8; this.vx = -this.facing * 150; this.setState('dazed');
        } else if (this.st > 2.4) { this.recT = 0.6; this.setState('recover'); }
        break;
      }
      case 'dazed': tla = 1.4; lsp = 4; this.crouch = 8; if (this.st > this.dazeT) this.setState('idle'); break;
      case 'throwW':
        tla = -2.3; lsp = 7; this.lean = -0.1;
        if (this.st >= 0.7 / S) { this.throwRock(); this.recT = 0.6 / S; this.setState('recover'); }
        break;
      case 'leapW':
        tla = -2.0; this.crouch = 16;
        if (this.st >= 0.5) {
          this.vy = -1150; this.vx = clamp((p.x - this.x) / 1.15, -700, 700);
          this.facing = dx >= 0 ? 1 : -1;
          this.setState('leap'); Sound.roar();
        }
        break;
      case 'leap':
        ctrl = false; tla = -2.4;
        if (this.grounded && this.st > 0.2) { this.vx = 0; this.impact(this.x, 1.2); this.stuckT = 0.9; this.setState('stuck'); }
        break;
      case 'recover': tla = 0.9; if (this.st > this.recT) this.setState('idle'); break;
    }
    if (tla !== null) this.la += (tla - this.la) * Math.min(1, dt * lsp);
    if (ctrl) this.vx = approach(this.vx, move * mspd, (this.grounded ? 1200 : 300) * dt);
    this.physics(dt);
    this.phase += Math.abs(this.vx) * dt * 0.02;
    // club geometry - the club scrapes along the ground instead of sinking into it
    const sh = this.shoulder(), s = this.s;
    const wa = this.facing > 0 ? this.la : Math.PI - this.la;
    const c = Math.cos(wa), sn = Math.sin(wa);
    const hx = sh.x + c * 15 * s, hy = sh.y + sn * 15 * s;
    let len = this.clubLen;
    if (sn > 0.05) len = Math.min(len, Math.max(50, (gy - 8 - hy) / sn));
    this.curLen = len;
    this.hand.x = hx; this.hand.y = hy; this.wang = wa;
    setBlade(this.club, hx + c * 20, hy + sn * 20, hx + c * len, hy + sn * len);
    bladeAttack(this, this.club);
    standPose(this.pose, {
      x: this.x, footY: gy, facing: this.facing, s, phase: this.phase,
      run: this.grounded ? Math.min(1.3, Math.abs(this.vx) / 120) : 0, air: !this.grounded, vy: this.vy,
      lean: this.lean, crouch: this.crouch, hF: this.hand,
      hB: (this.state === 'slamW' || this.state === 'slam' || this.state === 'sweep' || this.state === 'sweepW' || this.state === 'stuck')
        ? { x: hx - c * 14, y: hy - sn * 14 }
        : (this.state === 'throwW' ? { x: sh.x - this.facing * 20, y: sh.y - 34 } : null),
    });
  }
  choose() {
    const adx = Math.abs(G.player.x - this.x);
    const o = adx < 260 ? ['slamW', 'sweepW', 'slamW', 'throwW', 'chargeW'] : ['chargeW', 'throwW', 'slamW', 'chargeW'];
    if (this.p2) o.push('leapW', 'leapW');
    this.idleR = rand(0, 0.6);
    this.setState(this.pickAtk(o));
  }
  impact(x, pw) {
    const gy = this.footY();
    Sound.boom(Math.min(1.2, pw * 0.8)); G.shake(13 * pw);
    FX.debris(x, gy - 4, 14, G.level.pal.rockLight); FX.dust(x, gy, 12, 'rgba(255,220,180,0.5)', 160);
    FX.ring(x, gy, 10, 120 * pw, '#ffd0a0', 0.4, 4);
    for (const d of [-1, 1]) {
      G.projectiles.push(new Projectile('shock', x + d * 20, gy - 15, d * 520 * pw, 0,
        { deflect: false, w: 34, h: 24 + 14 * pw, groundY: gy, dmg: 1, kb: 300, life: 3, src: "the Oni's shockwave" }));
    }
  }
  rockFall(n) {
    const A = G.level.arena, x0 = (A.c0 + 2) * T, x1 = (A.c1 - 3) * T, gy = A.top * T;
    for (let i = 0; i < n; i++) {
      const x = i === 0 ? clamp(G.player.x, x0, x1) : rand(x0, x1);
      G.projectiles.push(makeMarker(x, gy, 0.8 + i * 0.18, (m) => {
        G.projectiles.push(new Projectile('rock', m.x, G.viewTop - 30, 0, 300, { grav: 1400, r: 16, deflect: 'heavy', dmg: 1, shooter: this, src: 'a falling rock' }));
      }));
    }
  }
  throwRock() {
    const p = G.player, hx = this.x - this.facing * 10, hy = this.y - 70;
    const g = 1200, v = Math.max(650, Math.sqrt(g * Math.abs(p.x - hx) * 1.3));
    const a = ballisticAngle(p.x - hx, p.y - hy, v, g);
    G.projectiles.push(new Projectile('rock', hx, hy, Math.cos(a) * v, Math.sin(a) * v, { grav: g, r: 18, deflect: 'heavy', dmg: 2, shooter: this, kb: 700, src: "the Oni's boulder" }));
    Sound.swing();
  }
  onHurt(dmg, proj) {
    if (proj && proj.type === 'rock' && this.state !== 'phase') {
      this.dazeT = 1.4; this.setState('dazed');
      FX.text(this.x, this.y - this.h / 2 - 20, 'BONK!', '#ffe14a', 24);
    }
  }
  draw(ctx) {
    this.drawShadow(ctx);
    if (this.p2) {
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, this.h * 0.9);
      gr.addColorStop(0, 'rgba(255,80,20,0.3)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gr; ctx.fillRect(this.x - this.h, this.y - this.h, this.h * 2, this.h * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    if (this.state === 'throwW') {
      ctx.fillStyle = G.level.pal.rockLight;
      ctx.beginPath(); ctx.arc(this.pose.hB.x, this.pose.hB.y - 12, 18, 0, TAU); ctx.fill();
    }
    // kanabo club
    ctx.save(); ctx.translate(this.hand.x, this.hand.y); ctx.rotate(this.wang);
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(-14, -4, 34, 8);
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#3a2c28';
    ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(this.curLen, -13); ctx.quadraticCurveTo(this.curLen + 8, 0, this.curLen, 13); ctx.lineTo(18, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c2b2';
    for (let i = 0; i < 6; i++) {
      const xx = 34 + i * ((this.curLen - 40) / 6);
      ctx.beginPath(); ctx.arc(xx, -7 - i, 2.5, 0, TAU); ctx.arc(xx + 6, 7 + i, 2.5, 0, TAU); ctx.fill();
    }
    if (this.state === 'slamW' || this.state === 'sweepW') {
      ctx.strokeStyle = `rgba(255,220,120,${0.4 + Math.sin(G.time * 30) * 0.3})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(this.curLen, -15); ctx.stroke();
    }
    ctx.restore();
    if (this.state === 'dazed') drawStars(ctx, this.pose.head.x, this.pose.head.y - 30, G.time, 26);
  }
}

// ================================================================== Tengu
class Tengu extends Boss {
  constructor(x, gy) {
    const s = 1.3;
    super(x, gy - 220, 30, 54 * s);
    this.s = s; this.name = 'KARASU'; this.title = 'Tengu of the Crow Peaks'; this.kanji = '天狗';
    this.hp = this.maxHp = 56; this.style = STYLES.tengu; this.bloodCol = '#1a1a22';
    this.phaseLine = 'KAAAAAW!!';
    this.blade = mkBlade({ r: 3.5, dmg: 2 }); this.blades = [this.blade]; this.bladeLen = 76; this.breakAt = 3;
    this.la = 0.6; this.wing = 0; this.spread = 0; this.hx = x; this.hy = gy - 280;
    const A = G.level.arena;
    this.ax0 = (A.c0 + 2) * T + 24; this.ax1 = (A.c1 - 3) * T - 24; this.gy = A.top * T;
    this.ddx = 0; this.ddy = 1; this.windDir = 1; this.ft = 0; this.hoverT = 1; this.stuckT = 1;
    this.hand = { x, y: gy }; this.wang = 0;
    this.setState('intro');
  }
  phaseSound() { Sound.caw(); }
  // grounded after a dive: a kick knocks him sprawling for a longer punish window
  kicked(dir) {
    if (this.state !== 'stuck') return;
    this.vx = dir * 320; this.vy = -260; this.setState('fall');
    FX.feathers(this.x, this.y, 6);
  }
  flyTo(dt, k) {
    this.x = lerp(this.x, this.hx, Math.min(1, dt * k));
    this.y = lerp(this.y, this.hy + Math.sin(G.time * 3) * 8, Math.min(1, dt * k));
    this.x = clamp(this.x, this.ax0, this.ax1);
  }
  enterHover() {
    const p = G.player;
    this.hx = clamp(p.x + rand(-300, 300), this.ax0 + 60, this.ax1 - 60);
    this.hy = this.gy - rand(240, 330);
    this.hoverT = rand(0.9, 1.5) / this.S;
    this.setState('hover');
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, S = this.S;
    this.blade.active = false; this.spread = Math.max(0, this.spread - dt * 3);
    let tla = 0.5, lsp = 10, flap = 9;
    const face = () => { this.facing = dx >= 0 ? 1 : -1; };
    switch (this.state) {
      case 'intro':
        face(); this.flyTo(dt, 2);
        if (this.st > 0.5 && !this.cawed) { this.cawed = true; Sound.caw(); }
        if (this.st > 2.0) this.enterHover();
        break;
      case 'phase':
        this.hittable = false; this.flyTo(dt, 2); this.spread = 1; flap = 18;
        if (Math.random() < 0.2) FX.feathers(this.x, this.y, 1);
        if (this.st > 1.6) { this.p2 = true; this.hittable = true; this.enterHover(); }
        break;
      case 'hover': face(); this.flyTo(dt, 2.2); if (this.st > this.hoverT) this.choose(); break;
      case 'featherW':
        face(); this.flyTo(dt, 3); this.spread = 1; tla = -0.6;
        if (this.st >= 0.55 / S) { this.volley(); if (this.p2) this.setState('feather2'); else this.enterHover(); }
        break;
      case 'feather2':
        face(); this.flyTo(dt, 3); this.spread = 1;
        if (this.st >= 0.35) { this.volley(); this.enterHover(); }
        break;
      case 'diveW':
        tla = null; flap = 16;
        this.x -= this.ddx * 40 * dt; this.y -= this.ddy * 40 * dt;
        this.facing = this.ddx >= 0 ? 1 : -1;
        if (this.st >= (this.p2 ? 0.5 : 0.72) / S) { startSwing(this.blade); this.setState('dive'); Sound.caw(); }
        break;
      case 'dive': {
        tla = null; flap = 0; this.blade.active = true;
        const sp = 1300 * Math.min(1.2, S);
        this.vx = this.ddx * sp; this.vy = this.ddy * sp;
        this.x += this.vx * dt; this.y += this.vy * dt;
        const fx = this.x + this.ddx * 30, fy = this.y + this.ddy * 40;
        const hitGround = this.y + this.h / 2 >= this.gy;
        if (hitGround || G.level.solidAt(fx, fy) || this.x < this.ax0 || this.x > this.ax1) {
          this.x = clamp(this.x, this.ax0, this.ax1);
          G.shake(9); Sound.thunk(); Sound.boom(0.45);
          FX.debris(fx, Math.min(fy, this.gy), 8, G.level.pal.rockLight);
          this.vx = this.vy = 0;
          if (hitGround) { this.y = this.gy - this.h / 2; FX.dust(this.x, this.gy, 10); this.stuckT = this.p2 ? 1.0 : 1.35; this.setState('stuck'); }
          else this.setState('fall');
        } else if (this.st > 1.4) this.enterHover();
        break;
      }
      case 'fall':
        tla = 1.4; flap = 3;
        this.vy = Math.min(this.vy + GRAV * dt, 1000);
        moveBody(this, dt, G.level);
        if (this.grounded) { this.stuckT = 1.6; this.setState('stuck'); }
        break;
      case 'stuck':
        flap = 1.5; tla = 1.45; lsp = 20;
        if (this.st > this.stuckT) { this.hx = this.x; this.hy = this.gy - 280; this.setState('rise'); Sound.caw(); }
        break;
      case 'rise': face(); this.flyTo(dt, 3); flap = 18; if (this.st > 0.6) this.enterHover(); break;
      case 'gustW': this.flyTo(dt, 3); this.facing = this.windDir; if (this.st > 0.8) { this.setState('gust'); Sound.wind(); this.ft = 0.3; } break;
      case 'gust': {
        this.flyTo(dt, 3); this.facing = this.windDir; this.spread = 1; flap = 22; tla = -1;
        G.windNext = this.windDir * (this.p2 ? 470 : 420);
        for (let i = 0; i < 2; i++) FX.ambientWind(G.cam.x - this.windDir * (G.viewW / 2 + 40) + rand(-40, 300) * this.windDir, G.viewTop + rand(0, G.viewH), this.windDir);
        if (this.p2) { this.ft -= dt; if (this.ft <= 0) { this.ft = 0.5; this.shootFeather(); } }
        if (this.st > (this.p2 ? 2.4 : 2.0)) this.enterHover();
        break;
      }
      case 'tornadoW':
        this.flyTo(dt, 3); this.spread = 1; flap = 20;
        if (this.st > 0.6) {
          const t = new Projectile('tornado', this.x, this.gy, sgn(p.x - this.x) * 170, 0, { deflect: false, w: 70, h: 250, groundY: this.gy, life: 6.5, src: 'a tornado' });
          G.projectiles.push(t); Sound.wind(); this.enterHover();
        }
        break;
    }
    if (tla !== null) this.la += (tla - this.la) * Math.min(1, dt * lsp);
    this.wing += dt * flap;
    const sh = this.shoulder(), s = this.s;
    let wa;
    if (this.state === 'dive' || this.state === 'diveW') wa = Math.atan2(this.ddy, this.ddx);
    else if (this.state === 'stuck') wa = Math.PI / 2 + this.facing * 0.15;
    else wa = this.facing > 0 ? this.la : Math.PI - this.la;
    const c = Math.cos(wa), sn = Math.sin(wa);
    const hx = sh.x + c * 15 * s, hy = sh.y + sn * 15 * s;
    this.hand.x = hx; this.hand.y = hy; this.wang = wa;
    setBlade(this.blade, hx + c * 9 * s, hy + sn * 9 * s, hx + c * this.bladeLen, hy + sn * this.bladeLen);
    bladeAttack(this, this.blade);
    const onGround = this.state === 'stuck' || (this.state === 'fall' && this.grounded);
    standPose(this.pose, {
      x: this.x, footY: this.y + this.h / 2, facing: this.facing, s, phase: 0, run: 0,
      air: !onGround, vy: 1, lean: this.state === 'dive' ? 0.5 : this.state === 'stuck' ? 0.4 : 0.1,
      crouch: this.state === 'stuck' ? 10 : 0, hF: this.hand, hB: { x: sh.x - this.facing * 10, y: sh.y + 12 },
    });
  }
  choose() {
    const o = ['featherW', 'diveW', 'featherW', 'diveW', 'gustW'];
    if (this.p2) o.push('tornadoW', 'diveW');
    const a = this.pickAtk(o);
    if (a === 'diveW') {
      const p = G.player, dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
      this.ddx = dx / d; this.ddy = dy / d;
      if (this.ddy < 0.25) { this.ddy = 0.25; const l = Math.hypot(this.ddx, this.ddy); this.ddx /= l; this.ddy /= l; }
    }
    if (a === 'gustW') {
      const mid = (this.ax0 + this.ax1) / 2;
      this.windDir = G.player.x < mid ? -1 : 1;
      this.hx = this.windDir < 0 ? this.ax1 - 50 : this.ax0 + 50; this.hy = this.gy - 210;
      FX.text(this.x, this.y - 60, 'HOLD ON TO SOMETHING', '#fff', 13, { bubble: true, life: 1.3, vy: -20 });
    }
    this.setState(a);
  }
  volley() {
    const p = G.player, n = this.p2 ? 7 : 5, sh = this.shoulder();
    const base = Math.atan2(p.y - 10 - sh.y, p.x - sh.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      G.projectiles.push(new Projectile('feather', sh.x, sh.y, Math.cos(a) * 560, Math.sin(a) * 560, { r: 5, shooter: this, src: "the Tengu's feathers", life: 4 }));
    }
    Sound.caw(); FX.feathers(sh.x, sh.y, 4);
  }
  shootFeather() {
    const p = G.player, sh = this.shoulder();
    const a = Math.atan2(p.y - 10 - sh.y, p.x - sh.x);
    G.projectiles.push(new Projectile('feather', sh.x, sh.y, Math.cos(a) * 520, Math.sin(a) * 520, { r: 5, shooter: this, src: "the Tengu's feathers", life: 4 }));
  }
  onShatter() { this.stuckT = 2.4; this.setState('fall'); this.vy = -200; FX.feathers(this.x, this.y, 12); }
  onParried() { this.vx = -this.ddx * 250; this.vy = -280; FX.feathers(this.x, this.y, 8); this.setState('fall'); }
  onBlocked() { this.onParried(); }
  drawWings(ctx) {
    const n = this.pose.neck, f = this.facing;
    const fl = Math.sin(this.wing) * 0.5 + this.spread * 0.7;
    for (const side of [0, 1]) {
      ctx.save(); ctx.translate(n.x - f * 3, n.y + 6); ctx.scale(-f, 1);
      ctx.rotate(-0.2 - fl * 0.7 + side * 0.3);
      ctx.fillStyle = side === 0 ? '#07070c' : (this.flash > 0 ? '#fff' : this.style.wing);
      const sc = this.s;
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -45, 82, -42);
      ctx.lineTo(70, -30); ctx.lineTo(84, -24); ctx.lineTo(66, -14); ctx.lineTo(78, -6); ctx.lineTo(56, -2); ctx.lineTo(62, 8);
      ctx.quadraticCurveTo(25, 12, 0, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  draw(ctx) {
    this.drawShadow(ctx);
    if (this.state === 'diveW') {
      // telegraph line
      const k = this.st / ((this.p2 ? 0.5 : 0.72) / this.S);
      ctx.strokeStyle = `rgba(255,50,50,${0.25 + k * 0.6})`; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([14, 10]);
      let x = this.x, y = this.y;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 70; i++) { x += this.ddx * 20; y += this.ddy * 20; if (G.level.solidAt(x, y) || y > this.gy) break; }
      ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    }
    this.drawWings(ctx);
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    // fan
    const hb = this.pose.hB;
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath(); ctx.ellipse(hb.x - this.facing * 4, hb.y - 10, 8, 14, -this.facing * 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hb.x, hb.y); ctx.lineTo(hb.x - this.facing * 4, hb.y - 22); ctx.stroke();
    drawKatana(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.s, this.style, this.state === 'diveW' ? '#ff6060' : null);
    drawCracks(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.cracks, this.broken, this.s);
    if (this.state === 'stuck' && this.stuckT > 1.5) drawStars(ctx, this.pose.head.x, this.pose.head.y - 18, G.time, 14);
  }
}

// ================================================================== Kitsune
class Kitsune extends Boss {
  constructor(x, gy, master = null) {
    const s = 1.12;
    super(x, gy - 27 * s - 18, 26, 54 * s);
    this.s = s; this.master = master; this.isClone = !!master; this.isBoss = !master;
    this.name = 'KUZUNOHA'; this.title = 'the Nine-Tailed'; this.kanji = '狐';
    this.hp = this.maxHp = master ? 1 : 60; this.style = STYLES.kitsune; this.bloodCol = '#7fd8ff';
    this.phaseLine = "Now let's play properly~";
    this.tailBlades = [mkBlade({ r: 6, dmg: 1 }), mkBlade({ r: 6, dmg: 1 }), mkBlade({ r: 6, dmg: 1 })];
    this.blades = this.tailBlades;
    for (const b of this.tailBlades) b.solid = false;
    this.alpha = 1; this.fox = false; this.orbs = 0; this.whipK = 0; this.tailMode = 'idle';
    const A = G.level.arena;
    this.ax0 = (A.c0 + 2) * T + 20; this.ax1 = (A.c1 - 3) * T - 20; this.gy = A.top * T;
    this.life = 7; this.clones = []; this.idleX = x; this.idleT = 1; this.recT = 0.6; this.stagT = 1.2;
    this.setState(master ? 'orbsW' : 'intro');
  }
  phaseSound() { Sound.fox(); Sound.roar(); }
  tails() { const m = this.master || this; return Math.min(9, 3 + Math.floor((1 - m.hp / m.maxHp) * 6.99)); }
  hurtboxes() {
    if (this.fox) return [{ x: this.x - 30, y: this.gy - 42, w: 60, h: 36 }];
    return [{ x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }];
  }
  enterIdle() {
    const p = G.player;
    this.idleX = clamp(p.x + pick([-1, 1]) * rand(220, 340), this.ax0, this.ax1);
    this.idleT = rand(0.7, 1.2) / this.S;
    this.fox = false; this.alpha = 1; this.hittable = true;
    this.setState('idle');
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, adx = Math.abs(dx), S = this.S;
    let moveX = null, ctrl = true;
    this.tailMode = 'idle';
    for (const b of this.tailBlades) { b.active = false; b.solid = false; }
    const face = () => { this.facing = dx >= 0 ? 1 : -1; };
    let ty = this.gy - this.h / 2 - 16 + Math.sin(G.time * 2 + this.x * 0.01) * 5;
    if (this.isClone) {
      this.life -= dt;
      if (this.life <= 0 || !this.master || this.master.dead) { this.poof(); return; }
    }
    switch (this.state) {
      case 'intro': face(); if (this.st > 0.4 && !this.yelped) { this.yelped = true; Sound.fox(); } if (this.st > 2.0) this.enterIdle(); break;
      case 'phase':
        this.hittable = false; this.tailMode = 'flare';
        FX.fire(this.x + rand(-30, 30), this.y + rand(-30, 30), 1);
        if (this.st > 1.6) { this.p2 = true; this.enterIdle(); }
        break;
      case 'idle': face(); moveX = this.idleX; if (this.st > this.idleT) this.choose(); break;
      case 'cloneIdle': face(); if (this.st > 2.4) this.setState('orbsW'); break;
      case 'orbsW':
        face(); this.tailMode = 'flare';
        this.orbs = this.isClone ? 2 : (this.p2 ? 5 : 3);
        if (this.st >= 0.65 / S) { this.releaseOrbs(); this.orbs = 0; if (this.isClone) this.setState('cloneIdle'); else this.enterIdle(); }
        break;
      case 'teleOut':
        this.alpha = 1 - this.st / 0.3; this.hittable = false;
        if (this.st >= 0.3) {
          this.x = clamp(p.x + pick([-1, 1]) * rand(170, 300), this.ax0, this.ax1); this.y = ty;
          FX.smoke(this.x, this.y, 8, 'rgba(160,230,255,0.5)'); Sound.poof();
          this.setState('teleIn');
        }
        break;
      case 'teleIn':
        this.alpha = this.st / 0.25;
        if (this.st >= 0.25) { this.alpha = 1; this.hittable = true; face(); this.setState(adx < 230 ? 'whipW' : 'orbsW'); }
        break;
      case 'whipW':
        face(); this.tailMode = 'raise';
        if (this.st >= 0.5 / S) { this.tailBlades.forEach(startSwing); this.whipK = 0; this.setState('whip'); Sound.swing(); }
        break;
      case 'whip': {
        ctrl = false; this.tailMode = 'whip';
        const k = Math.min(1, this.st / 0.24); this.whipK = easeOut(k);
        for (const b of this.tailBlades) { b.active = true; b.solid = true; }
        this.vx = this.facing * 160;
        if (k >= 1) { this.recT = 0.6 / S; this.setState('recover'); }
        break;
      }
      case 'clonesW':
        this.tailMode = 'flare'; this.alpha = 1 - this.st / 0.3; this.hittable = false;
        if (this.st >= 0.3) this.spawnClones();
        break;
      case 'lungeW':
        face(); this.fox = true; this.tailMode = 'back'; ty = this.gy - 24;
        if (Math.random() < 0.5) FX.fire(this.x, this.gy - 6, 1);
        if (this.st >= 0.55 / S) { this.setState('lunge'); Sound.fox(); this.bodyHit = false; }
        break;
      case 'lunge': {
        ctrl = false; this.fox = true; this.tailMode = 'back'; ty = this.gy - 24;
        this.vx = this.facing * 1150 * Math.min(1.2, S);
        FX.fire(this.x - this.facing * 20, this.y, 2);
        if (!this.bodyHit && rectsOverlap(this.hurtboxes()[0], p.hurtbox()) && p.hurt(1, this.facing * 800, -500, this.name)) this.bodyHit = true;
        if (this.st > 1.1 || (this.facing < 0 && this.x <= this.ax0 + 2) || (this.facing > 0 && this.x >= this.ax1 - 2)) {
          this.vx = 0; this.recT = 0.7; this.fox = false; this.setState('recover');
        }
        break;
      }
      case 'spiralW':
        this.tailMode = 'flare'; ty = this.gy - 300;
        this.x = lerp(this.x, (this.ax0 + this.ax1) / 2, Math.min(1, dt * 4));
        if (this.st > 0.7) { this.spA = 0; this.spT = 0; this.setState('spiral'); }
        break;
      case 'spiral': {
        ctrl = false; this.vx = 0; this.tailMode = 'flare'; ty = this.gy - 300;
        this.spT -= dt;
        if (this.spT <= 0) {
          this.spT = 0.11;
          for (let i = 0; i < 3; i++) {
            const a = this.spA + (i * TAU) / 3;
            G.projectiles.push(new Projectile('foxfire', this.x, this.y, Math.cos(a) * 200, Math.sin(a) * 200, { r: 7, shooter: this, life: 5, src: 'foxfire' }));
          }
          this.spA += 0.33; Sound.fox();
        }
        if (this.st > 3.2) this.enterIdle();
        break;
      }
      case 'recover': if (this.st > this.recT) this.enterIdle(); break;
      case 'stagger': this.tailMode = 'droop'; ty = this.gy - this.h / 2; if (this.st > this.stagT) this.enterIdle(); break;
    }
    if (ctrl) {
      const tv = moveX !== null ? clamp((moveX - this.x) * 2, -170, 170) : 0;
      this.vx = approach(this.vx, tv, 900 * dt);
    }
    this.x = clamp(this.x + this.vx * dt, this.ax0, this.ax1);
    this.y = lerp(this.y, ty, Math.min(1, dt * 6));
    this.phase += dt * 2;
    // tails as blades during whip
    const hip = this.pose.hip;
    if (this.state === 'whip') {
      this.tailBlades.forEach((b, i) => {
        const la = lerp(-2.4, 1.0, this.whipK) + (i - 1) * 0.3;
        const wa = this.facing > 0 ? la : Math.PI - la;
        const c = Math.cos(wa), sn = Math.sin(wa);
        setBlade(b, hip.x + c * 20, hip.y + sn * 20, hip.x + c * 108, hip.y + sn * 108);
        bladeAttack(this, b);
      });
    } else {
      for (const b of this.tailBlades) setBlade(b, hip.x, hip.y, hip.x, hip.y);
    }
    const sh = this.shoulder();
    const casting = this.state === 'orbsW' || this.state === 'spiral' || this.state === 'spiralW';
    standPose(this.pose, {
      x: this.x, footY: this.y + this.h / 2, facing: this.facing, s: this.s, phase: this.phase, run: 0,
      air: true, vy: 1, lean: this.state === 'whip' ? 0.3 : 0.05,
      hF: casting ? { x: sh.x + this.facing * 10, y: sh.y - 18 } : { x: sh.x + this.facing * 14, y: sh.y + 8 },
      hB: casting ? { x: sh.x - this.facing * 6, y: sh.y - 20 } : null,
    });
  }
  choose() {
    const adx = Math.abs(G.player.x - this.x);
    const o = ['orbsW', 'teleOut', 'clonesW', 'lungeW', 'orbsW', 'teleOut'];
    if (adx < 200) o.push('whipW', 'whipW');
    if (this.p2) o.push('spiralW', 'clonesW');
    this.setState(this.pickAtk(o));
  }
  releaseOrbs() {
    const n = this.orbs, src = this.isClone ? this.master : this;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
      const ox = this.x + Math.cos(a) * 34, oy = this.y + Math.sin(a) * 34;
      G.projectiles.push(new Projectile('foxfire', ox, oy, Math.cos(a) * 250, Math.sin(a) * 250, { r: 8, homing: 2.1, shooter: src, life: 6, src: 'foxfire' }));
    }
    Sound.fox();
  }
  spawnClones() {
    const xs = [this.ax0 + 140, (this.ax0 + this.ax1) / 2, this.ax1 - 140].sort(() => Math.random() - 0.5);
    this.x = xs[0];
    for (const c of this.clones) c.poof();
    this.clones = [];
    for (let i = 1; i < 3; i++) {
      const c = new Kitsune(xs[i], this.gy, this);
      c.y = this.y; c.facing = this.facing;
      G.enemies.push(c); this.clones.push(c);
      FX.smoke(xs[i], this.y, 10, 'rgba(160,230,255,0.5)');
    }
    FX.smoke(this.x, this.y, 10, 'rgba(160,230,255,0.5)');
    Sound.poof();
    this.alpha = 1; this.hittable = true;
    this.setState('orbsW');
  }
  poof() {
    if (this.dead) return;
    this.dead = true; this.remove = true;
    FX.smoke(this.x, this.y, 12, 'rgba(160,230,255,0.6)'); FX.fire(this.x, this.y, 8);
    Sound.poof();
  }
  takeHit(dmg, dx, dy, hx, hy, speed, proj) {
    if (this.isClone) { FX.text(this.x, this.y - 50, 'FAKE!', '#7fd8ff', 18); this.poof(); return; }
    super.takeHit(dmg, dx, dy, hx, hy, speed, proj);
    for (const c of this.clones) c.poof();
    this.clones = [];
  }
  die(vx, vy) { if (this.isClone) this.poof(); else super.die(vx, vy); }
  kicked(dir) {
    if (this.isClone) { FX.text(this.x, this.y - 50, 'FAKE!', '#7fd8ff', 18); this.poof(); return; }
    this.vx = dir * 260;
  }
  onParried() { this.stagT = 1.2; this.setState('stagger'); }
  onBlocked() { this.recT = 0.5; this.setState('recover'); }
  drawTails(ctx) {
    const n = this.tails(), hip = this.pose.hip, f = this.facing, t = G.time;
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0.5;
      let la, len = 70 * this.s;
      switch (this.tailMode) {
        case 'raise': la = -2.0 - (u - 0.5) * 1.0; len = 82 * this.s; break;
        case 'whip': la = lerp(-2.4, 1.0, this.whipK) + (u - 0.5) * 0.9; len = 92 * this.s; break;
        case 'flare': la = -1.57 + (u - 0.5) * 3.2 + Math.sin(t * 6 + i) * 0.08; len = 76 * this.s; break;
        case 'back': la = Math.PI + (u - 0.5) * 0.6 + Math.sin(t * 20 + i) * 0.08; break;
        case 'droop': la = Math.PI - 0.25 + (u - 0.5) * 0.5; break;
        default: la = Math.PI + 0.35 - (u - 0.5) * 1.1 + Math.sin(t * 2.5 + i * 0.7) * 0.12;
      }
      const wa = f > 0 ? la : Math.PI - la;
      const ex = hip.x + Math.cos(wa) * len, ey = hip.y + Math.sin(wa) * len;
      const cx = hip.x + Math.cos(wa + 0.5 * f) * len * 0.6, cy = hip.y + Math.sin(wa + 0.5 * f) * len * 0.6;
      ctx.strokeStyle = this.flash > 0 ? '#fff' : '#f4efe6'; ctx.lineCap = 'round';
      ctx.lineWidth = 11 * this.s;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = this.tailMode === 'raise' || this.tailMode === 'whip' ? 'rgba(255,140,140,0.8)' : 'rgba(127,216,255,0.75)';
      ctx.beginPath(); ctx.arc(ex, ey, 7 * this.s, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  drawFox(ctx) {
    const x = this.x, y = this.gy - 24, f = this.facing;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    const run = Math.sin(G.time * 30) * 6;
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#f4efe6';
    for (let i = 0; i < this.tails(); i++) {
      ctx.save(); ctx.rotate(Math.PI + (i - this.tails() / 2) * 0.09);
      ctx.beginPath(); ctx.ellipse(32, 0, 30, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(22, -14); ctx.lineTo(48, -2); ctx.lineTo(24, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -12); ctx.lineTo(28, -26); ctx.lineTo(34, -10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f4efe6'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(18 + run, 22); ctx.moveTo(-16, 6); ctx.lineTo(-20 - run, 22); ctx.stroke();
    ctx.fillStyle = '#d22a3c'; ctx.beginPath(); ctx.arc(34, -6, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  draw(ctx) {
    if (!this.isClone) this.drawShadow(ctx);
    ctx.globalAlpha = clamp(this.alpha, 0, 1) * (this.isClone ? 0.92 + Math.sin(G.time * 13) * 0.05 : 1);
    if (this.fox) { this.drawFox(ctx); ctx.globalAlpha = 1; return; }
    if (this.state === 'lungeW') {
      ctx.fillStyle = 'rgba(127,216,255,0.25)';
      ctx.fillRect(Math.min(this.x, this.x + this.facing * 900), this.gy - 6, 900, 6);
    }
    this.drawTails(ctx);
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    if (this.orbs) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.orbs; i++) {
        const a = G.time * 4 + (i * TAU) / this.orbs;
        const ox = this.x + Math.cos(a) * 36, oy = this.y + Math.sin(a) * 36;
        const gr = ctx.createRadialGradient(ox, oy, 1, ox, oy, 14);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(127,216,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ox, oy, 14, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.state === 'stagger') drawStars(ctx, this.pose.head.x, this.pose.head.y - 16, G.time, 13);
    ctx.globalAlpha = 1;
  }
}

function makeBoss(type, x, gy) {
  switch (type) {
    case 'ronin': return new Ronin(x, gy);
    case 'shogun': return new Ronin(x, gy, { s: 1.4, hp: 84, spd: 1.1, bladeLen: 100, style: STYLES.shogun, name: 'KUROGANE', title: 'the Iron Shogun', kanji: '将軍', rain: true, phaseLine: 'Kneel.' });
    case 'oni': return new Oni(x, gy);
    case 'tengu': return new Tengu(x, gy);
    case 'kitsune': return new Kitsune(x, gy);
  }
  return null;
}
