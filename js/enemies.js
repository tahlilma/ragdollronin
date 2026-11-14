'use strict';
const BARKS = {
  aggro: ['Have at thee!', 'HYAAH!', 'For the clan!', 'Is that a noodle?', 'Prepare yourself!', 'You again?!', 'Halt!', 'Ronin scum!'],
  die: ['Ow.', 'Tell my mother...', 'Worth it.', 'Not the face!', 'Dishonor!', 'I slipped!', 'Ack!', 'Lag!', 'Unfair...'],
  archer: ['Hold still!', 'Arrows! Lots!', 'Pew.', 'Eat feathers!'],
};

function mkBlade(o = {}) {
  return {
    ax: 0, ay: 0, bx: 0, by: 0, pax: 0, pay: 0, pbx: 0, pby: 0, init: false,
    r: o.r || 3, dmg: o.dmg || 1, heavy: !!o.heavy, parryable: o.parryable !== false,
    solid: o.solid !== false, guardBreak: !!o.guardBreak,
    active: false, hitDone: false, cancelled: false, kx: o.kx || null, ky: o.ky || null,
  };
}
function setBlade(b, ax, ay, bx, by) {
  if (!b.init) { b.pax = ax; b.pay = ay; b.pbx = bx; b.pby = by; b.init = true; }
  else { b.pax = b.ax; b.pay = b.ay; b.pbx = b.bx; b.pby = b.by; }
  b.ax = ax; b.ay = ay; b.bx = bx; b.by = by;
}
function startSwing(b) { b.hitDone = false; b.cancelled = false; b.t = 0; }
// tilt a held weapon up just enough that its tip stays above the floor the wielder stands on
function keepAboveGround(wa, shy, reach, footY) {
  const lim = (footY - 4 - shy) / reach;
  if (lim >= 1 || Math.sin(wa) <= lim) return wa;
  const cs = (Math.cos(wa) < 0 ? -1 : 1) * Math.sqrt(1 - lim * lim);
  return Math.atan2(lim, cs);
}

// enemy blade sweeping: clash with the player's blade, else hurt the player
function bladeAttack(e, b) {
  if (!b.active || b.cancelled) return;
  b.t = (b.t || 0) + STEP; // how long this swing has been live (early parries are "perfect")
  const p = G.player;
  if (p.dead) return;
  const mx0 = (b.ax + b.pax) / 2, my0 = (b.ay + b.pay) / 2, mx1 = (b.bx + b.pbx) / 2, my1 = (b.by + b.pby) / 2;
  if (!p.rag && !b.hitDone && p.bladeOut) {
    const sw = p.sword;
    const rr = b.r + 3;
    if (segSegDist(sw.bx, sw.by, sw.tx, sw.ty, b.ax, b.ay, b.bx, b.by) < rr || segSegDist(sw.bx, sw.by, sw.tx, sw.ty, mx0, my0, mx1, my1) < rr) {
      G.bladeClash(p, e, b, Math.abs(sw.av));
      if (b.cancelled || b.hitDone) return;
    }
  }
  if (b.hitDone) return;
  const hb = grow(p.hurtbox(), b.r);
  if (segRect(b.ax, b.ay, b.bx, b.by, hb) >= 0 || segRect(mx0, my0, mx1, my1, hb) >= 0) {
    const kx = b.kx !== null ? b.kx * e.facing : e.facing * 520;
    const ky = b.ky !== null ? b.ky : -380;
    if (p.hurt(b.dmg, kx, ky, e.name)) b.hitDone = true;
  }
}

class Actor {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0;
    this.grounded = false; this.facing = -1; this.hp = this.maxHp = 1;
    this.dead = false; this.remove = false; this.flash = 0; this.swordCD = 0; this.clashCD = 0;
    this.hittable = true; this.blades = []; this.state = 'idle'; this.st = 0;
    this.pose = newPose(); this.phase = 0; this.isBoss = false; this.name = 'an enemy';
    this.bloodCol = '#b3122a'; this.s = 1;
  }
  hurtboxes() { return [{ x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }]; }
  setState(s) { this.state = s; this.st = 0; }
  base(dt) { this.flash -= dt; this.swordCD -= dt; this.clashCD -= dt; this.st += dt; }
  physics(dt, grav = true) {
    if (grav) this.vy = Math.min(this.vy + GRAV * dt, 1100);
    moveBody(this, dt, G.level);
  }
  shoulder() { return { x: this.x + this.facing * this.s, y: this.y - 15 * this.s }; }
  footY() { return this.y + this.h / 2; }
  // returns true if walking 'dir' would step into a pit
  ledgeAhead(dir) {
    const L = G.level, ax = this.x + dir * (this.w / 2 + 6), fy = this.y + this.h / 2 + 4;
    return L.get(Math.floor(ax / T), Math.floor(fy / T)) === 0 && L.get(Math.floor(ax / T), Math.floor(fy / T) + 1) === 0;
  }
  takeHit(dmg, dx, dy, hx, hy, speed, proj) {
    if (this.dead) return;
    if (this.state === 'stagger') dmg += 1;
    this.hp -= dmg; this.flash = 0.12;
    FX.blood(hx, hy, 5 + dmg * 5, dx, dy, this.bloodCol);
    Sound.slash(dmg);
    if (dmg >= 3) FX.text(hx, hy - 14, 'CRIT!', '#ffe14a', 22);
    else if (dmg === 2) FX.text(hx, hy - 14, 'SLASH!', '#ffffff', 16);
    if (!this.isBoss) { this.vx += dx * 140 * dmg; this.vy += Math.min(0, dy * 90 * dmg) - 90; }
    if (this.hp <= 0) this.die(dx * speed * 0.3, dy * speed * 0.3 - 250);
    else this.onHurt(dmg, proj);
  }
  onHurt() {}
  // shoved by the player's kick: knockback grows with damage taken (ledges and spikes do the rest)
  kicked(dir) {
    const k = 1 + (1 - this.hp / this.maxHp) * 1.2;
    this.vx = dir * 620 * k; this.vy = -330 * k;
    this.grounded = false;
  }
  die(vx, vy) {
    if (this.dead) return;
    this.dead = true; this.remove = true;
    G.kills++;
    Sound.edeath();
    if (Math.random() < 0.55) FX.text(this.x, this.y - 50, pick(BARKS.die), '#fff', 13, { bubble: true, life: 1.4, vy: -30 });
    G.addCorpse(this, vx, vy);
    if (this.hatProp) this.hatProp(vx, vy);
  }
  drawShadow(ctx) {
    const gy = G.level.groundBelow(this.x, this.y, 5);
    if (gy === null) return;
    const d = gy - (this.y + this.h / 2);
    const a = clamp(0.35 - d / 600, 0, 0.35);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(this.x, gy, this.w * 0.8, 4, 0, 0, TAU); ctx.fill();
  }
}

// ------------------------------------------------------------------ Samurai
class Samurai extends Actor {
  constructor(x, y, o = {}) {
    super(x, y - 27, 24, 54);
    this.heavy = !!o.heavy;
    this.name = this.heavy ? 'a very large samurai' : 'a samurai';
    this.hp = this.maxHp = o.hp || (this.heavy ? 7 : 4);
    this.speed = o.speed || (this.heavy ? 120 : 150);
    this.windupT = o.windup || (this.heavy ? 0.55 : 0.5);
    this.combo = o.combo || (this.heavy ? 3 : 1);
    this.style = this.heavy ? STYLES.heavy : STYLES.samurai;
    this.blade = mkBlade({ r: 3, dmg: this.heavy ? 2 : 1 }); this.blades = [this.blade];
    this.bladeLen = this.heavy ? 70 : 60;
    this.la = -0.7; this.cool = rand(0.2, 0.8); this.comboN = 0; this.guardT = 0; this.staggerT = 0;
    this.glinted = false;
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
    let move = 0, tla = -0.7, lsp = 12;
    const locked = this.state === 'slash' || this.state === 'windup' || this.state === 'stagger' || this.state === 'recover';
    if (!locked) this.facing = dx >= 0 ? 1 : -1;
    switch (this.state) {
      case 'idle':
        if (adx < 560 && Math.abs(dy) < 260 && !p.dead) {
          this.setState('approach');
          if (Math.random() < 0.4) FX.text(this.x, this.y - 50, pick(BARKS.aggro), '#fff', 13, { bubble: true, life: 1.3, vy: -25 });
        }
        break;
      case 'approach':
        this.cool -= dt;
        if (p.dead) { this.setState('idle'); break; }
        if (adx > 74) move = this.facing; else if (adx < 40) move = -this.facing * 0.6;
        if (adx < 100 && this.cool <= 0 && Math.abs(dy) < 90) {
          if (Math.random() < (this.heavy ? 0.15 : 0.3)) { this.setState('guard'); this.guardT = rand(0.6, 1.1); }
          else { this.comboN = 0; this.glinted = false; this.setState('windup'); }
        }
        if (adx > 900) this.setState('idle');
        break;
      case 'guard':
        tla = -1.35; lsp = 20;
        if (this.st > this.guardT) { this.comboN = 0; this.glinted = false; this.setState('windup'); }
        break;
      case 'windup': {
        const wt = this.comboN > 0 ? this.windupT * 0.55 : this.windupT;
        tla = -2.5; lsp = 11;
        if (!this.glinted && this.st > wt - 0.15) { this.glinted = true; FX.glint(this.blade.bx, this.blade.by, '#ffffff', 18); }
        if (this.st >= wt) { this.setState('slash'); startSwing(this.blade); this.la = -2.5; Sound.swing(); }
        break;
      }
      case 'slash': {
        const d = 0.16, k = Math.min(1, this.st / d);
        this.la = lerp(-2.5, 1.1, easeOut(k)); tla = null;
        if (this.st < 0.08) this.vx = this.facing * 260;
        if (k >= 1) this.setState('recover');
        break;
      }
      case 'recover':
        tla = 1.1;
        if (this.st > 0.45) {
          this.comboN++;
          if (this.comboN < this.combo && adx < 140) { this.glinted = false; this.setState('windup'); }
          else { this.cool = rand(0.6, 1.3); this.setState('approach'); }
        }
        break;
      case 'stagger':
        tla = 1.5; lsp = 5;
        if (this.st > this.staggerT) { this.cool = 0.4; this.setState('approach'); }
        break;
      case 'flinch':
        tla = 0.6;
        if (this.st > 0.22) this.setState('approach');
        break;
    }
    if (tla !== null) this.la += (tla - this.la) * Math.min(1, dt * lsp);
    if (move !== 0 && this.grounded) {
      if (this.ledgeAhead(move)) move = 0;
      else if (G.level.solidAt(this.x + move * (this.w / 2 + 6), this.y)) this.vy = -640;
    }
    if (this.state !== 'slash') this.vx = approach(this.vx, move * this.speed, (this.grounded ? 1400 : 300) * dt);
    this.physics(dt);
    if (this.y > G.level.height + 150) { this.dead = true; this.remove = true; G.kills++; return; }
    this.phase += Math.abs(this.vx) * dt * 0.05;
    // weapon + pose
    const sh = this.shoulder();
    const wa = keepAboveGround(this.facing > 0 ? this.la : Math.PI - this.la, sh.y, 15 + this.bladeLen, this.footY());
    const c = Math.cos(wa), s = Math.sin(wa);
    const hx = sh.x + c * 15, hy = sh.y + s * 15;
    this.hand = { x: hx, y: hy }; this.wang = wa;
    setBlade(this.blade, hx + c * 9, hy + s * 9, hx + c * this.bladeLen, hy + s * this.bladeLen);
    this.blade.active = this.state === 'slash';
    bladeAttack(this, this.blade);
    standPose(this.pose, {
      x: this.x, footY: this.footY(), facing: this.facing, s: 1, phase: this.phase,
      run: this.grounded ? Math.min(1, Math.abs(this.vx) / 150) : 0, air: !this.grounded, vy: this.vy,
      lean: this.state === 'slash' ? 0.25 : this.state === 'windup' ? -0.12 : 0.05,
      crouch: this.state === 'windup' ? 4 : this.state === 'stagger' ? 6 : 0,
      hF: this.hand, hB: { x: hx - c * 6, y: hy - s * 6 },
    });
  }
  onParried() { this.setState('stagger'); this.staggerT = this.heavy ? 0.8 : 1.1; this.vx = -this.facing * 260; }
  kicked(dir) {
    super.kicked(this.heavy ? dir * 0.55 : dir);
    this.blade.cancelled = true;
    this.setState('stagger'); this.staggerT = this.heavy ? 0.35 : 0.55;
  }
  onBlocked() { this.setState('recover'); this.vx = -this.facing * 180; }
  onHurt(dmg) {
    if (this.state === 'stagger') return;
    if (dmg >= 2 && !this.heavy) this.setState('flinch');
    else if (this.state === 'approach' && this.cool > 0.3) this.cool = 0.3;
  }
  hatProp(vx, vy) {
    const st = this.style;
    FX.prop({
      x: this.pose.head.x, y: this.pose.head.y - 6, vx: vx * 0.5 + rand(-60, 60), vy: Math.min(-350, vy * 0.6), vr: rand(-14, 14),
      draw(ctx) {
        ctx.fillStyle = st.helm; ctx.beginPath(); ctx.arc(0, 0, 8.5, Math.PI, TAU); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = st.crest; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0.75, -15.75, 7.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      },
    });
  }
  draw(ctx) {
    this.drawShadow(ctx);
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    const glow = this.state === 'windup' && this.st > this.windupT * 0.4 ? '#ffdada' : null;
    drawKatana(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, 1, this.style, glow);
    if (this.state === 'stagger') drawStars(ctx, this.pose.head.x, this.pose.head.y - 14, G.time);
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(this.x - 16, this.y - 46, 32, 4);
      ctx.fillStyle = '#e5323d'; ctx.fillRect(this.x - 16, this.y - 46, 32 * (this.hp / this.maxHp), 4);
    }
  }
}

// ------------------------------------------------------------------ Archer
const ARROW_G = 650, ARROW_V = 800;
class Archer extends Actor {
  constructor(x, y, o = {}) {
    super(x, y - 26, 22, 52);
    this.name = 'an archer';
    this.hp = this.maxHp = o.hp || 2;
    this.drawT = o.draw || 0.95; this.volley = o.volley || 1;
    this.style = STYLES.archer;
    this.cool = rand(0.6, 1.6); this.aim = 0; this.barked = false;
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
    let move = 0;
    if (this.state !== 'flee') this.facing = dx >= 0 ? 1 : -1;
    const onScreen = Math.abs(this.x - G.cam.x) < G.viewW / 2 + 60;
    switch (this.state) {
      case 'idle':
        this.cool -= dt;
        if (p.dead) break;
        if (adx < 190 && this.grounded && !this.ledgeAhead(-this.facing)) { this.setState('flee'); this.facing = -this.facing; break; }
        if (this.cool <= 0 && adx < 820 && Math.abs(dy) < 420 && onScreen) {
          this.setState('draw');
          if (!this.barked && Math.random() < 0.4) { this.barked = true; FX.text(this.x, this.y - 50, pick(BARKS.archer), '#fff', 13, { bubble: true, life: 1.2, vy: -25 }); }
        }
        break;
      case 'flee':
        move = this.facing;
        if (this.ledgeAhead(move) || this.st > 0.7) { this.cool = 0.1; this.setState('idle'); }
        break;
      case 'draw': {
        const sx = this.x + this.facing * 10, sy = this.y - 14;
        const tx = p.x + p.vx * 0.22, ty = p.y - 6;
        this.aim = ballisticAngle(tx - sx, ty - sy, ARROW_V, ARROW_G);
        if (this.st >= this.drawT) {
          for (let i = 0; i < this.volley; i++) {
            const a = this.aim + (i - (this.volley - 1) / 2) * 0.09;
            G.projectiles.push(new Projectile('arrow', sx, sy, Math.cos(a) * ARROW_V, Math.sin(a) * ARROW_V, { grav: ARROW_G, shooter: this, src: 'an arrow', r: 4 }));
          }
          Sound.shoot();
          this.cool = rand(1.1, 1.9);
          this.setState('idle');
        }
        break;
      }
    }
    this.vx = approach(this.vx, move * 170, (this.grounded ? 1400 : 300) * dt);
    this.physics(dt);
    if (this.y > G.level.height + 150) { this.dead = true; this.remove = true; G.kills++; return; }
    this.phase += Math.abs(this.vx) * dt * 0.05;
    const sh = this.shoulder();
    const a = this.state === 'draw' ? this.aim : (this.facing > 0 ? 0.9 : Math.PI - 0.9);
    const c = Math.cos(a), s = Math.sin(a);
    this.bowAng = a;
    this.bowHand = { x: sh.x + c * 19, y: sh.y + s * 19 };
    const pull = this.state === 'draw' ? Math.min(1, this.st / (this.drawT * 0.7)) : 0;
    this.pull = pull;
    const back = { x: sh.x + c * (16 - pull * 14), y: sh.y + s * (16 - pull * 14) };
    standPose(this.pose, {
      x: this.x, footY: this.footY(), facing: this.facing, s: 1, phase: this.phase,
      run: this.grounded ? Math.min(1, Math.abs(this.vx) / 150) : 0, air: !this.grounded, vy: this.vy,
      lean: this.state === 'draw' ? -0.05 : 0, hF: this.bowHand, hB: back,
    });
  }
  hatProp(vx, vy) {
    const col = this.style.kasa;
    FX.prop({
      x: this.pose.head.x, y: this.pose.head.y - 6, vx: vx * 0.5 + rand(-80, 80), vy: Math.min(-420, vy * 0.6), vr: rand(-16, 16),
      draw(ctx) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(0, -11); ctx.closePath(); ctx.fill(); },
    });
  }
  draw(ctx) {
    this.drawShadow(ctx);
    // aim telegraph
    if (this.state === 'draw' && this.st > this.drawT - 0.4) {
      const k = (this.st - (this.drawT - 0.4)) / 0.4;
      ctx.strokeStyle = `rgba(255,70,70,${0.15 + k * 0.4})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
      ctx.beginPath();
      let x = this.bowHand.x, y = this.bowHand.y, vx = Math.cos(this.aim) * ARROW_V, vy = Math.sin(this.aim) * ARROW_V;
      ctx.moveTo(x, y);
      for (let i = 0; i < 18; i++) { const h = 0.035; vy += ARROW_G * h; x += vx * h; y += vy * h; ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    // bow
    const a = this.bowAng, h = this.bowHand;
    const px = -Math.sin(a), py = Math.cos(a);
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(h.x + px * 26, h.y + py * 26);
    ctx.quadraticCurveTo(h.x + Math.cos(a) * 12, h.y + Math.sin(a) * 12, h.x - px * 26, h.y - py * 26); ctx.stroke();
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 0.8;
    const bh = this.pose.hB;
    ctx.beginPath(); ctx.moveTo(h.x + px * 26, h.y + py * 26); ctx.lineTo(bh.x, bh.y); ctx.lineTo(h.x - px * 26, h.y - py * 26); ctx.stroke();
    if (this.state === 'draw') {
      ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bh.x, bh.y); ctx.lineTo(bh.x + Math.cos(a) * 30, bh.y + Math.sin(a) * 30); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ corpses
class Corpse {
  constructor(e, vx, vy) {
    this.rag = new Ragdoll(e.pose, vx, vy, rand(-8, 8));
    this.style = e.style; this.t = 0; this.pose = newPose();
    this.blen = e.bladeLen || 0; this.s = e.s || 1;
    this.rag.toPose(this.pose);
  }
  update(dt) {
    this.t += dt;
    if (this.t >= 6) return;
    this.rag.update(dt, G.level); this.rag.toPose(this.pose);
    const p = this.pose;
    if (this.blen) this.wang = fitBladeAngle(G.level, p.hF.x, p.hF.y, Math.atan2(p.hF.y - p.eF.y, p.hF.x - p.eF.x), this.blen);
  }
  get gone() { return this.t > 8 || this.pose.hip.y > G.level.height + 300; }
  draw(ctx) {
    ctx.globalAlpha = this.t > 6 ? Math.max(0, 1 - (this.t - 6) / 2) : 1;
    const p = this.pose;
    drawFigure(ctx, p, this.style, sgn(p.head.x - p.hip.x), this.t < 0.08);
    if (this.blen) drawKatana(ctx, p.hF.x, p.hF.y, this.wang !== undefined ? this.wang : Math.atan2(p.hF.y - p.eF.y, p.hF.x - p.eF.x), this.blen, this.s, this.style, null);
    ctx.globalAlpha = 1;
  }
}

function makeEnemy(type, x, y, o) {
  switch (type) {
    case 'samurai': return new Samurai(x, y, o);
    case 'heavy': return new Samurai(x, y, Object.assign({ heavy: true }, o));
    case 'archer': return new Archer(x, y, o);
  }
  return null;
}
