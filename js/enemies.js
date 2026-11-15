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
// the point on a blade closest to (x, y): where it cut you
function bladePointNear(b, x, y) {
  const dx = b.bx - b.ax, dy = b.by - b.ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - b.ax) * dx + (y - b.ay) * dy) / l2, 0, 1);
  return { x: b.ax + dx * t, y: b.ay + dy * t };
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
    if (p.hurt(b.dmg, kx, ky, e.name, 0, bladePointNear(b, p.x, p.y))) b.hitDone = true;
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
    this.cracks = 0; this.breakAt = 3; this.broken = false; this.execT = 0;
  }
  hurtboxes() { return [{ x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }]; }
  setState(s) { this.state = s; this.st = 0; }
  // a perfect parry cracks the blade; enough cracks and it shatters, leaving them open to execution
  crackWeapon() {
    if (this.broken || !this.blade || !this.bladeLen) return;
    this.cracks++;
    const b = this.blade, tx = b.bx, ty = b.by;
    FX.spark(tx, ty, 18, null, TAU, 520, '#fff6c8');
    if (this.cracks < this.breakAt) {
      Sound.crack();
      FX.text(tx, ty - 18, `CRACK ${this.cracks}/${this.breakAt}`, '#ffe9a8', 15);
      return;
    }
    this.broken = true;
    const lost = this.bladeLen * 0.45;
    this.bladeLen -= lost;
    b.dmg = Math.max(1, b.dmg - 1);
    Sound.shatter(); G.shake(10); G.hitstop = Math.max(G.hitstop, 0.08); G.slowmo(0.3, 0.5);
    FX.parryBurst(tx, ty, 0.7);
    FX.text(this.x, this.y - this.h / 2 - 36, 'SHATTERED!', '#ffffff', 26);
    // the snapped-off half spins away
    const ang = Math.atan2(b.by - b.ay, b.bx - b.ax), st = this.style;
    FX.prop({
      x: tx, y: ty, vx: rand(-260, 260), vy: rand(-520, -300), vr: rand(-22, 22), life: 8,
      draw(ctx) { drawKatana(ctx, -lost - 8, 0, 0, lost + 8, 1, st, null); },
    });
    if (this.onShatter) this.onShatter();
    this.execT = 2.2; // stunned and defenceless: the next blow executes
  }
  base(dt) {
    this.flash -= dt; this.swordCD -= dt; this.clashCD -= dt; this.st += dt; this.execT -= dt;
    // an open wound keeps bleeding while they fight on
    if (this.bleedT > 0 && Settings.gore) {
      this.bleedT -= dt;
      if (Math.random() < 30 * dt * Math.min(1, this.bleedT)) {
        const s = this.s || 1;
        FX.add({ t: 'blob', x: this.x + this.bleedOx * s, y: this.y + this.bleedOy * s, vx: rand(-40, 40) + this.vx * 0.5, vy: rand(-60, 20), life: 1.5, max: 1.5, col: this.bloodCol, grav: 1400, size: rand(1.2, 2.6) });
      }
    }
  }
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
    let force = null;
    if (this.execT > 0 && !proj) { // EXECUTION: a disarmed foe dies to the next blow (bosses take a huge hit)
      this.execT = 0;
      dmg = this.isBoss ? Math.max(dmg, 8) : this.hp;
      force = Math.random() < 0.7 ? 'head' : 'waist';
      FX.text(this.x, this.y - this.h / 2 - 40, 'EXECUTED!', '#ff4a4a', 30, { font: 'mincho' });
      Sound.riposte(); G.slowmo(0.2, 0.6); G.flash = Math.max(G.flash, 0.25); G.shake(14);
      FX.blood(hx, hy, 60, dx, dy, this.bloodCol);
    } else if (this.state === 'stagger') dmg += 1;
    this.hp -= dmg; this.flash = 0.12;
    this.lastHit = { hx, hy, dmg, dx, dy, force }; // decides what gets cut off if this blow kills
    FX.blood(hx, hy, 14 + dmg * 10, dx, dy, this.bloodCol);
    this.bleedT = Math.max(this.bleedT || 0, 2 + dmg); this.bleedOx = clamp((hx - this.x) / (this.s || 1), -10, 10); this.bleedOy = clamp((hy - this.y) / (this.s || 1), -24, 24);
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
    if (G.player) G.player.onKill(this);
    Sound.edeath();
    if (Math.random() < 0.55) FX.text(this.x, this.y - 50, pick(BARKS.die), '#fff', 13, { bubble: true, life: 1.4, vy: -30 });
    G.addCorpse(this, vx, vy);
    const pl = G.player; // killed right in front of you: it hits the lens
    if (pl && Math.hypot(pl.x - this.x, pl.y - this.y) < 190) FX.screenSplat(2 + Math.floor(Math.random() * 3), this.bloodCol);
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
    // kinds: samurai, heavy, spear (ashigaru: long thrusts that out-reach you), ninja (fast, fragile, throws shuriken)
    const kind = this.kind = o.kind || (this.heavy ? 'heavy' : 'samurai');
    const spear = this.spear = kind === 'spear', ninja = this.ninja = kind === 'ninja';
    this.name = this.heavy ? 'a very large samurai' : spear ? 'a spearman' : ninja ? 'a shinobi' : 'a samurai';
    this.hp = this.maxHp = o.hp || (this.heavy ? 7 : ninja ? 2 : 4);
    this.speed = o.speed || (this.heavy ? 120 : spear ? 125 : ninja ? 235 : 150);
    this.windupT = o.windup || (this.heavy ? 0.55 : spear ? 0.62 : ninja ? 0.3 : 0.5);
    this.combo = o.combo || (this.heavy ? 3 : ninja ? 2 : 1);
    this.style = STYLES[kind];
    this.blade = mkBlade({ r: 3, dmg: this.heavy ? 2 : 1 }); this.blades = [this.blade];
    this.bladeLen = this.heavy ? 70 : spear ? 112 : ninja ? 46 : 60;
    this.breakAt = this.heavy ? 4 : ninja ? 2 : 3;
    this.reach = spear ? 168 : 100; this.keep = spear ? 132 : 74; this.tooClose = spear ? 96 : 40;
    this.handR = 15; this.ta = 0; this.throwCD = rand(0.8, 2);
    if (ninja) this.scarf = new Rope(6, 4.5, x, y - 50);
    this.la = -0.7; this.cool = rand(0.2, 0.8); this.comboN = 0; this.guardT = 0; this.staggerT = 0;
    this.glinted = false;
  }
  // a spear thrust is aimed at wherever the player stands when the wind-up starts
  aimThrust(p) { this.ta = clamp(Math.atan2(p.y - 6 - (this.y - 15), Math.abs(p.x - this.x)), -0.55, 0.35); }
  // is there somewhere to land past this gap?
  canLeap(dir) {
    for (let k = 3; k <= 5; k++) if (G.level.groundBelow(this.x + dir * k * T, this.y - 60, 5) !== null) return true;
    return false;
  }
  update(dt) {
    this.base(dt);
    const p = G.player, dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
    let move = 0, tla = -0.7, lsp = 12, thr = 15;
    const spear = this.spear;
    this.throwCD -= dt;
    const locked = this.state === 'slash' || this.state === 'windup' || this.state === 'stagger' || this.state === 'recover' || this.state === 'throw';
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
        // reads an iai being charged nearby and raises his guard (once per charge)
        if (p.iai && p.iai.phase === 'charge' && p.iai !== this.readIai && adx < 340 && Math.abs(dy) < 120) {
          this.readIai = p.iai;
          if (Math.random() < (this.heavy ? 0.9 : 0.55)) { this.setState('guard'); this.guardT = 1.4; FX.text(this.x, this.y - 50, '!', '#ffffff', 20); break; }
        }
        if (p.dead) { this.setState('idle'); break; }
        if (adx > this.keep) move = this.facing; else if (adx < this.tooClose) move = -this.facing * (spear ? 1 : 0.6);
        if (this.ninja && this.throwCD <= 0 && adx > 200 && adx < 560 && Math.abs(dy) < 200) { this.glinted = false; this.setState('throw'); break; }
        if (adx < this.reach && this.cool <= 0 && Math.abs(dy) < 90) {
          if (Math.random() < (this.heavy ? 0.15 : this.ninja ? 0.1 : 0.3)) { this.setState('guard'); this.guardT = rand(0.6, 1.1); }
          else { this.comboN = 0; this.glinted = false; this.aimThrust(p); this.setState('windup'); }
        }
        if (adx > 900) this.setState('idle');
        break;
      case 'guard':
        tla = -1.35; lsp = 20;
        if (this.st > this.guardT) { this.comboN = 0; this.glinted = false; this.aimThrust(p); this.setState('windup'); }
        break;
      case 'throw': // shinobi: a glint, then a shuriken
        tla = -1.9; lsp = 18;
        if (!this.glinted && this.st > 0.12) { this.glinted = true; FX.glint(this.x + this.facing * 8, this.y - 26, '#c8f0ff', 16); }
        if (this.st > 0.4) {
          const sx = this.x + this.facing * 10, sy = this.y - 16, a = Math.atan2(p.y - 8 - sy, p.x + p.vx * 0.2 - sx);
          G.projectiles.push(new Projectile('shuriken', sx, sy, Math.cos(a) * 620, Math.sin(a) * 620, { r: 6, shooter: this, src: 'a shuriken' }));
          Sound.shoot(); this.throwCD = rand(2.2, 3.4); this.glinted = false; this.cool = Math.max(this.cool, 0.25);
          this.setState('approach');
        }
        break;
      case 'windup': {
        const wt = this.comboN > 0 ? this.windupT * 0.55 : this.windupT;
        tla = -2.5; lsp = 11;
        if (spear) { tla = this.ta; lsp = 14; thr = 2; }
        if (!this.glinted && this.st > wt - 0.15) { this.glinted = true; FX.glint(this.blade.bx, this.blade.by, '#ffffff', 18); }
        if (this.st >= wt) { this.setState('slash'); startSwing(this.blade); if (!spear) this.la = -2.5; Sound.swing(); }
        break;
      }
      case 'slash': {
        const d = 0.16, k = Math.min(1, this.st / d);
        tla = null;
        if (spear) { this.la = this.ta; thr = lerp(2, 40, easeOut(k)); }
        else this.la = lerp(-2.5, 1.1, easeOut(k));
        if (this.st < 0.08) this.vx = this.facing * (spear ? 200 : this.ninja ? 380 : 260);
        if (k >= 1) this.setState('recover');
        break;
      }
      case 'recover':
        tla = 1.1;
        if (spear) { tla = this.ta; thr = 40 - Math.min(1, this.st / 0.6) * 25; } // the shaft hangs out there: punish it
        if (this.st > (spear ? 0.65 : this.ninja ? 0.28 : 0.45)) {
          this.comboN++;
          if (this.comboN < this.combo && adx < 140) { this.glinted = false; this.setState('windup'); }
          else {
            this.cool = rand(0.6, 1.3); this.setState('approach');
            if (this.ninja && this.grounded) { this.vx = -this.facing * 400; this.vy = -430; this.grounded = false; } // flips away
          }
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
    this.handR += (thr - this.handR) * Math.min(1, dt * (this.state === 'slash' ? 60 : 14));
    if (move !== 0 && this.grounded) {
      if (this.ledgeAhead(move)) {
        if (this.ninja && sgn(move) === this.facing && this.canLeap(sgn(move))) { this.vy = -700; this.vx = sgn(move) * 330; this.grounded = false; }
        else move = 0;
      }
      else if (G.level.solidAt(this.x + move * (this.w / 2 + 6), this.y)) this.vy = -640;
    }
    if (this.state !== 'slash') this.vx = approach(this.vx, move * this.speed, (this.grounded ? 1400 : this.ninja ? 0 : 300) * dt);
    this.physics(dt);
    if (this.y > G.level.height + 150) { this.dead = true; this.remove = true; G.kills++; if (G.player) G.player.onKill(this, true); return; }
    this.phase += Math.abs(this.vx) * dt * 0.05;
    // weapon + pose
    const sh = this.shoulder(), hr = this.handR;
    const wa = keepAboveGround(this.facing > 0 ? this.la : Math.PI - this.la, sh.y, hr + this.bladeLen, this.footY());
    const c = Math.cos(wa), s = Math.sin(wa);
    const hx = sh.x + c * hr, hy = sh.y + s * hr;
    this.hand = { x: hx, y: hy }; this.wang = wa;
    const b0 = spear ? this.bladeLen * 0.45 : 9; // only the business end of a spear cuts
    setBlade(this.blade, hx + c * b0, hy + s * b0, hx + c * this.bladeLen, hy + s * this.bladeLen);
    if (this.scarf) this.scarf.update(this.pose.neck.x - this.facing * 3, this.pose.neck.y + 1, (G.wind || 0) * 0.0004 - this.vx * 0.0004);
    this.blade.active = this.state === 'slash';
    bladeAttack(this, this.blade);
    standPose(this.pose, {
      x: this.x, footY: this.footY(), facing: this.facing, s: 1, phase: this.phase,
      run: this.grounded ? Math.min(1, Math.abs(this.vx) / 150) : 0, air: !this.grounded, vy: this.vy,
      lean: this.state === 'slash' ? 0.25 : this.state === 'windup' ? -0.12 : 0.05,
      crouch: this.state === 'windup' ? 4 : this.state === 'stagger' ? 6 : 0,
      hF: this.hand, hB: spear ? { x: hx - c * 16, y: hy - s * 16 } : { x: hx - c * 6, y: hy - s * 6 },
    });
  }
  onParried() { this.setState('stagger'); this.staggerT = this.heavy ? 0.8 : this.spear ? 1.3 : 1.1; this.vx = -this.facing * 260; }
  onShatter() { this.setState('stagger'); this.staggerT = 2.2; FX.text(this.x, this.y - 70, pick(['My blade!', 'No...', 'Mercy!']), '#fff', 13, { bubble: true, life: 1.4, vy: -20 }); }
  takeHit(dmg, dx, dy, hx, hy, speed, proj) {
    // a raised guard facing you catches the iai draw-cut, then he counter-attacks
    const p = G.player;
    if (!proj && this.state === 'guard' && p.iai && p.iai.phase === 'strike' && sgn(p.x - this.x) === this.facing) {
      p.iaiBlocked(this);
      this.comboN = 0; this.glinted = false; this.aimThrust(p); this.setState('windup');
      return;
    }
    super.takeHit(dmg, dx, dy, hx, hy, speed, proj);
  }
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
    if (this.ninja) return;
    FX.prop({
      x: this.pose.head.x, y: this.pose.head.y - 6, vx: vx * 0.5 + rand(-60, 60), vy: Math.min(-350, vy * 0.6), vr: rand(-14, 14),
      draw(ctx) {
        if (st.hat === 'kasa') { ctx.fillStyle = st.kasa; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill(); return; }
        ctx.fillStyle = st.helm; ctx.beginPath(); ctx.arc(0, 0, 8.5, Math.PI, TAU); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = st.crest; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0.75, -15.75, 7.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      },
    });
  }
  draw(ctx) {
    this.drawShadow(ctx);
    if (this.scarf) this.scarf.draw(ctx, this.style.scarf, 3);
    drawFigure(ctx, this.pose, this.style, this.facing, this.flash > 0);
    const glow = this.state === 'windup' && this.st > this.windupT * 0.4 ? '#ffdada' : null;
    if (this.spear) drawSpear(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.style, glow);
    else drawKatana(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, 1, this.style, glow);
    drawCracks(ctx, this.hand.x, this.hand.y, this.wang, this.bladeLen, this.cracks, this.broken, 1);
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
    if (this.y > G.level.height + 150) { this.dead = true; this.remove = true; G.kills++; if (G.player) G.player.onKill(this, true); return; }
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
    this.blen = e.bladeLen || 0; this.s = e.s || 1; this.spear = !!e.spear;
    this.col = e.bloodCol || '#b3122a';
    this.headAng = Math.atan2(e.pose.head.y - e.pose.neck.y, e.pose.head.x - e.pose.neck.x) + Math.PI / 2;
    this.headSpin = rand(-16, 16);
    this.poolT = 0; this.puddle = null;
    // the killing blow decides what comes off
    const h = e.lastHit;
    if (h) {
      const part = h.force && Settings.gore ? h.force : pickSever(e.pose, h.hx, h.hy, h.dmg, false);
      if (part && this.rag.sever(part, h.dx * 420, -280 + h.dy * 220)) {
        FX.blood(h.hx, h.hy, 26, h.dx, h.dy, this.col);
        if (part === 'head') FX.text(e.x, e.y - 60, pick(['DECAPITATED!', 'HEADS UP!', 'OFF WITH IT!']), '#ff5a5a', 18);
        else if (part === 'waist') FX.text(e.x, e.y - 60, 'CUT IN HALF!', '#ff5a5a', 18);
      }
    }
    this.rag.toPose(this.pose);
  }
  update(dt) {
    this.t += dt;
    if (this.t >= 18) return;
    this.rag.update(dt, G.level); this.rag.toPose(this.pose);
    const p = this.pose, cut = this.rag.cut;
    bleed(p, cut, this.t, this.col, this.s, dt);
    if (cut & CUT.head) { // a loose head tumbles until it comes to rest
      const q = this.rag.p.head, sp = Math.hypot(q.x - q.ox, q.y - q.oy) / STEP;
      this.headSpin *= sp < 40 ? 0.85 : 0.995;
      this.headAng += this.headSpin * dt;
    }
    // once the body settles it bleeds out into a spreading pool
    if (Settings.gore && this.t > 0.6 && this.t < 12 && this.rag.speed() < 60) {
      const gy = G.level.groundBelow(p.hip.x, p.hip.y - 10, 2);
      if (gy !== null && Math.abs(gy - p.hip.y) < 30) {
        if (!this.puddle) this.puddle = FX.pool(p.hip.x, gy + 1, this.col);
        this.puddle.r = Math.min(this.puddle.r + dt * (cut ? 12 : 6) * this.s, (cut ? 48 : 28) * this.s);
      }
    }
    if (this.blen) this.wang = fitBladeAngle(G.level, p.hF.x, p.hF.y, Math.atan2(p.hF.y - p.eF.y, p.hF.x - p.eF.x), this.blen);
  }
  get gone() { return this.t > 20 || this.pose.hip.y > G.level.height + 300; }
  draw(ctx) {
    ctx.globalAlpha = this.t > 18 ? Math.max(0, 1 - (this.t - 18) / 2) : 1;
    const p = this.pose;
    drawFigure(ctx, p, this.style, sgn(p.head.x - p.hip.x), this.t < 0.08, this.rag.cut, this.headAng);
    const wa = this.wang !== undefined ? this.wang : Math.atan2(p.hF.y - p.eF.y, p.hF.x - p.eF.x);
    if (this.spear) drawSpear(ctx, p.hF.x, p.hF.y, wa, this.blen, this.style, null);
    else if (this.blen) drawKatana(ctx, p.hF.x, p.hF.y, wa, this.blen, this.s, this.style, null, 0.6);
    ctx.globalAlpha = 1;
  }
}

function makeEnemy(type, x, y, o) {
  switch (type) {
    case 'samurai': return new Samurai(x, y, o);
    case 'heavy': return new Samurai(x, y, Object.assign({ heavy: true }, o));
    case 'spear': return new Samurai(x, y, Object.assign({ kind: 'spear' }, o));
    case 'ninja': return new Samurai(x, y, Object.assign({ kind: 'ninja' }, o));
    case 'archer': return new Archer(x, y, o);
  }
  return null;
}
