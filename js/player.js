'use strict';
// The samurai. The katana is a physically simulated blade pulled toward the mouse by a torque-limited
// spring. Stone stops it: only the tip may sink in (SW_ALLOW px). That tip is what you plant
// (right-click) and pivot around.
const SW_K = 950, SW_C = 46, SW_MAX = 34;
const SW_ALLOW = 6;               // how deep the tip may bite into stone
const SW_RMIN = 4, SW_RMAX = 20;  // how far the hand reaches from the shoulder
const RUN_SPEED = 275, JUMP_V = 720, DJUMP_V = 660, DASH_V = 950, DASH_T = 0.16;
const PIVOT_K = 5200;             // how hard the mouse swings you around a planted blade
const NO_INPUT = { down: () => false, take: () => false, mr: false };

// distance from (sx,sy) along `ang` to the first solid tile within [from, to]; to + 1 when clear
function rayFirstSolid(L, sx, sy, ang, from, to) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let d = from; d <= to; d += 3) {
    if (L.solidAt(sx + c * d, sy + s * d)) {
      let lo = Math.max(from, d - 3), hi = d;
      for (let i = 0; i < 4; i++) { const m = (lo + hi) / 2; if (L.solidAt(sx + c * m, sy + s * m)) hi = m; else lo = m; }
      return hi;
    }
  }
  return L.solidAt(sx + c * to, sy + s * to) ? to : to + 1;
}

// keep a loose blade (ragdolls, corpses) out of rock: nearest angle where only the tip touches
function fitBladeAngle(L, hx, hy, ang, len) {
  const ok = (a) => rayFirstSolid(L, hx, hy, a, 8, len) >= len - SW_ALLOW;
  if (ok(ang)) return ang;
  for (let k = 1; k <= 30; k++) for (const s of [1, -1]) { const a = ang + s * k * 0.1; if (ok(a)) return a; }
  return ang;
}

class Player {
  constructor(x, y, style) {
    this.x = x; this.y = y; this.w = 22; this.h = 54; this.vx = 0; this.vy = 0;
    this.grounded = false; this.facing = 1; this.hp = this.maxHp = 5;
    this.coyote = 0; this.jumpBuf = 0; this.dashBuf = 0; this.jumpHeld = false;
    this.djump = 1; this.airDash = 1; this.vaults = 3;
    this.dashT = 0; this.dashCD = 0; this.dashX = 0; this.dashY = 0;
    this.planted = null; this.plantCD = 0; this.ki = 100; this.winded = false; this.stun = 0;
    this.invuln = 0; this.rag = null; this.ragT = 0; this.getupT = 0;
    this.dead = false; this.deadT = 0; this.reported = false; this.lastAttacker = null;
    this.dropT = 0; this.dropThrough = false; this.onOneWay = false;
    this.phase = 0; this.lean = 0; this.pogoCD = 0; this.lastVy = 0; this.airT = 0;
    this.pose = newPose(); this.tmpPose = newPose(); this.snapPose = newPose();
    this.ghosts = []; this.ghostT = 0;
    this.kickT = 0; this.kickCD = 0; this.riposte = 0; this.thrown = null;
    this.style = style || STYLES.player;
    this.sword = { ang: -0.4, av: 0, r: 12, rDes: 12, len: 80, base: 10, hx: x, hy: y, bx: x, by: y, tx: x, ty: y, speed: 0, clangCD: 0, trail: [] };
    this.band1 = new Rope(7, 4.5, x, y - 30); this.band2 = new Rope(6, 4.2, x, y - 30);
    this.placeSword();
    this.buildPose();
  }

  shoulder() { return { x: this.x + this.facing * (1 + this.lean * 8), y: this.y - 15 + Math.abs(this.lean) * 2 }; }
  hurtbox() { return { x: this.x - 9, y: this.y - 24, w: 18, h: 50 }; }

  swordGeom(sx, sy, ang, r) {
    const sw = this.sword, c = Math.cos(ang), s = Math.sin(ang);
    return { hx: sx + c * r, hy: sy + s * r, bx: sx + c * (r + sw.base), by: sy + s * (r + sw.base), tx: sx + c * (r + sw.len), ty: sy + s * (r + sw.len) };
  }
  applyGeom(g) { const sw = this.sword; sw.hx = g.hx; sw.hy = g.hy; sw.bx = g.bx; sw.by = g.by; sw.tx = g.tx; sw.ty = g.ty; }
  placeSword() {
    if (this.thrown) return;
    const sh = this.shoulder();
    this.applyGeom(this.swordGeom(sh.x, sh.y, this.sword.ang, this.sword.r));
  }

  // ------------------------------------------------------------------
  update(dt) {
    const L = G.level, sw = this.sword;
    const I = G.inputBlocked ? NO_INPUT : Input;
    sw.clangCD -= dt; this.invuln -= dt; this.dashCD -= dt; this.plantCD -= dt; this.pogoCD -= dt; this.getupT -= dt; this.stun -= dt;
    this.kickCD -= dt; this.kickT -= dt; this.riposte -= dt;
    if (this.thrown) this.updateThrown(dt, I);

    if (this.dead) {
      this.deadT += dt;
      this.rag.update(dt, L); this.rag.toPose(this.pose); if (!this.thrown) this.ragSword();
      return;
    }
    if (this.rag) { this.updateRagdoll(dt); return; }

    // ---- kick (F) and throw / recall the katana (left click) ----
    if (I.take('KeyF') && this.kickCD <= 0) this.kick();
    if (I.take('Mouse0')) {
      if (this.thrown) this.recall();
      else if (!this.planted && this.stun <= 0) this.throwSword();
    }

    const ix = (I.down('KeyD', 'ArrowRight') ? 1 : 0) - (I.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const iy = (I.down('KeyS', 'ArrowDown') ? 1 : 0) - (I.down('KeyW', 'ArrowUp') ? 1 : 0);
    if (I.take('Space')) this.jumpBuf = 0.13;
    if (I.take('ShiftLeft', 'ShiftRight')) this.dashBuf = 0.12;
    this.jumpBuf -= dt; this.dashBuf -= dt;
    if (this.dashT <= 0) this.facing = G.mouse.x >= this.x ? 1 : -1;

    // ---- plant the blade tip (hold right mouse) ----
    this.wantPlant = I.mr && !this.planted && this.plantCD <= 0 && !this.thrown;
    if (this.wantPlant) this.tryPlant();
    if (this.planted && !I.mr) this.unplant();

    const wasGround = this.grounded;
    if (this.planted) {
      this.updatePlanted(dt, ix, I);
    } else {
      // ---- dash ----
      if (this.dashBuf > 0 && this.dashCD <= 0 && (this.grounded || this.airDash > 0)) {
        let dx = ix, dy = iy;
        if (!dx && !dy) dx = this.facing;
        if (this.grounded && dy > 0) dy = 0;
        if (!dx && !dy) dx = this.facing;
        const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        this.dashX = dx; this.dashY = dy; this.dashT = DASH_T; this.dashCD = 0.48; this.dashBuf = 0;
        if (!this.grounded) this.airDash--;
        Sound.dash(); FX.dust(this.x, this.y + 20, 6);
        FX.ring(this.x, this.y, 6, 34, '#ffffff', 0.25, 2);
      }
      if (this.dashT > 0) {
        this.dashT -= dt;
        this.vx = this.dashX * DASH_V; this.vy = this.dashY * DASH_V;
        if (this.dashT <= 0) { this.vx *= 0.45; this.vy *= 0.3; }
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.025; this.ghosts.push({ pose: copyPose(newPose(), this.pose), f: this.facing, a: 1 }); }
      } else {
        // ---- run ----
        const wind = G.wind || 0;
        const target = ix * RUN_SPEED + wind * (this.grounded ? 1 : 0.8);
        let a;
        if (this.grounded) a = ix ? 2600 : 2400;
        else a = ix ? 1500 : 260;
        if (Math.abs(this.vx) > RUN_SPEED && sgn(this.vx) === ix) a = this.grounded ? 1200 : 150;
        if (wind && !ix) a = Math.max(a, 900);
        this.vx = approach(this.vx, target, a * dt);
        // ---- gravity / jump ----
        let gmul = 1;
        if (this.vy < 0 && !I.down('Space') && this.jumpHeld) gmul = 2.2;
        if (this.vy >= 0) this.jumpHeld = false;
        this.vy = Math.min(this.vy + GRAV * gmul * dt, 1100);
        if (this.grounded) this.coyote = 0.1; else this.coyote -= dt;
        if (this.jumpBuf > 0) {
          if (this.coyote > 0) {
            this.vy = -JUMP_V; this.coyote = 0; this.jumpBuf = 0; this.jumpHeld = true;
            Sound.jump(); FX.dust(this.x, this.y + 26, 5);
          } else if (this.djump > 0) {
            this.vy = -DJUMP_V; this.djump--; this.jumpBuf = 0; this.jumpHeld = true;
            Sound.djump(); FX.ring(this.x, this.y + 24, 4, 26, '#ffffff', 0.3, 2);
          }
        }
      }
      this.dropT -= dt;
      if (I.take('KeyS', 'ArrowDown') && this.grounded && this.onOneWay) this.dropT = 0.25;
      this.dropThrough = this.dropT > 0;
    }

    this.lastVy = this.vy;
    moveBody(this, dt, L);
    if (this.grounded) {
      this.djump = 1; this.airDash = 1; this.vaults = 3;
      if (!wasGround && this.lastVy > 450) { Sound.land(); FX.dust(this.x, this.y + 26, 6); }
      this.airT = 0;
    } else this.airT += dt;

    // hazards
    const hz = L.hazardIn(this.hurtbox());
    if (hz) this.hurt(1, hz === 5 ? 500 : hz === 6 ? -500 : -sgn(this.vx || this.facing) * 260, hz === 4 ? 300 : -820, 'spikes');
    if (this.y > L.height + 120) this.die('the abyss');

    this.lean = this.grounded ? clamp(this.vx / RUN_SPEED, -1.2, 1.2) * 0.3 * this.facing : 0.1;
    this.phase += Math.abs(this.vx) * dt * 0.052;
    this.updateSword(dt);
    this.buildPose();
    this.updateGhosts(dt);
  }

  updateGhosts(dt) {
    for (const g of this.ghosts) g.a -= dt * 5;
    this.ghosts = this.ghosts.filter((g) => g.a > 0);
  }

  // ---- planting: only the tip bites into the stone ----
  // the blade is resting near a surface: plant if the tip is at (or just inside) the stone
  tryPlant() {
    const sw = this.sword, sh = this.shoulder();
    const reach = sw.r + sw.len;
    const fs = rayFirstSolid(G.level, sh.x, sh.y, sw.ang, 6, reach + 10);
    if (fs > reach + 10 || fs < sw.len - 1) return; // nothing there, or the blade is already buried past the tip
    this.plantAt(sh, sw.ang, fs);
  }
  plantAt(sh, ang, fs) {
    const sw = this.sword;
    const depth = clamp(fs + 5, sw.len + SW_RMIN, sw.len + SW_RMAX + 2);
    const c = Math.cos(ang), s = Math.sin(ang);
    const px = sh.x + c * depth, py = sh.y + s * depth;
    this.planted = { x: px, y: py, len: depth };
    Sound.plant(); FX.spark(sh.x + c * fs, sh.y + s * fs, 10, ang + Math.PI, 2.4, 320); FX.dust(px, py, 4);
    this.dashT = 0; this.wantPlant = false;
  }
  unplant() { if (this.planted) { this.planted = null; this.plantCD = 0.12; } }
  updatePlanted(dt, ix, I) {
    const a = this.planted, sw = this.sword;
    const rodMin = sw.len + SW_RMIN, rodMax = sw.len + SW_RMAX + 2;
    if (I.down('KeyW', 'ArrowUp')) a.len = Math.max(rodMin, a.len - 160 * dt);
    if (I.down('KeyS', 'ArrowDown')) a.len = Math.min(rodMax, a.len + 160 * dt);
    this.vy += GRAV * dt;
    if (G.wind) this.vx += G.wind * 0.1 * dt;
    const sh = this.shoulder();
    const dx = sh.x - a.x, dy = sh.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const tx = -ny, ty = nx; // moving along +t increases the angle of the blade
    // A/D pumps the swing
    const tdir = tx >= 0 ? 1 : -1;
    this.vx += tx * tdir * ix * 1500 * dt; this.vy += ty * tdir * ix * 1500 * dt;
    // the mouse pivots you around the tip: the body swings until the blade points at the cursor
    if (!G.inputBlocked) {
      const bladeAng = Math.atan2(a.y - sh.y, a.x - sh.x);
      const want = Math.atan2(G.mouse.y - sh.y, G.mouse.x - sh.x);
      const md = Math.hypot(G.mouse.x - sh.x, G.mouse.y - sh.y);
      const err = clamp(angDiff(bladeAng, want), -1.2, 1.2) * Math.min(1, md / 70);
      this.vx += tx * err * PIVOT_K * dt; this.vy += ty * err * PIVOT_K * dt;
    }
    const vt = this.vx * tx + this.vy * ty;
    this.vx -= tx * vt * 4 * dt; this.vy -= ty * vt * 4 * dt;
    // rigid rod: no stretching along the blade
    const vr = this.vx * nx + this.vy * ny;
    this.vx -= nx * vr; this.vy -= ny * vr;
    const err = d - a.len;
    this.vx -= (nx * err * 0.35) / dt; this.vy -= (ny * err * 0.35) / dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 1100) { this.vx *= 1100 / sp; this.vy *= 1100 / sp; }
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      if (this.vaults > 0) {
        this.unplant();
        this.vaults--; this.djump = 1;
        this.vy = Math.min(this.vy - 250, -760); this.vx = this.vx * 1.15 + ix * 160;
        this.jumpHeld = false;
        Sound.vault(); FX.ring(a.x, a.y, 4, 40, '#ffffff', 0.3, 2); FX.spark(a.x, a.y, 8, null, TAU, 300);
      } else {
        FX.text(this.x, this.y - 50, 'too tired', '#ffffff', 12);
      }
    }
  }

  // ---- sword simulation ----
  updateSword(dt) {
    const sw = this.sword, sh = this.shoulder();
    const ptx = sw.tx, pty = sw.ty;
    const mx = G.mouse.x, my = G.mouse.y;
    const target = Math.atan2(my - sh.y, mx - sh.x);

    if (this.thrown) { // empty-handed: catch your breath while the blade flies
      this.ki = Math.min(100, this.ki + 30 * dt);
      if (this.winded && this.ki >= 45) this.winded = false;
      sw.av = 0; sw.trail.length = 0;
      return;
    }

    if (this.planted) {
      const a = this.planted;
      sw.ang = Math.atan2(a.y - sh.y, a.x - sh.x); sw.av = 0;
      const d = Math.hypot(a.x - sh.x, a.y - sh.y);
      sw.r = clamp(d - sw.len, SW_RMIN, SW_RMAX + 2);
      // swung around a corner (blade would cut through rock), or shoved too close / too far: the tip levers free
      const fs = rayFirstSolid(G.level, sh.x, sh.y, sw.ang, 6, d);
      if (d - fs > SW_ALLOW + 5 || d < sw.len + SW_RMIN - 4 || d > sw.len + SW_RMAX + 14) {
        this.unplant();
        const px = sh.x + Math.cos(sw.ang) * fs, py = sh.y + Math.sin(sw.ang) * fs;
        FX.spark(px, py, 10, sw.ang + Math.PI, 2, 380); Sound.clang(0.6);
      } else {
        this.applyGeom(this.swordGeom(sh.x, sh.y, sw.ang, sw.r));
        sw.speed = 0; sw.trail.length = 0;
        Sound.whoosh(0);
        return;
      }
    }

    const md = Math.hypot(mx - sh.x, my - sh.y);
    sw.rDes += (clamp(6 + (md - 60) * 0.15, SW_RMIN, SW_RMAX) - sw.rDes) * Math.min(1, dt * 14);
    // ki: sustained fast swinging drains it; running dry leaves you winded with a sluggish blade
    const spd = Math.abs(sw.av);
    if (spd > 14) this.ki -= (spd - 14) * 3.2 * dt;
    else this.ki += (spd < 8 ? 40 : 16) * dt;
    this.ki = clamp(this.ki, 0, 100);
    if (!this.winded && this.ki <= 0) {
      this.winded = true;
      FX.text(this.x, this.y - 54, 'WINDED!', '#9fd8ff', 16);
    } else if (this.winded && this.ki >= 45) this.winded = false;
    const maxAV = this.stun > 0 ? 4 : this.winded ? 11 : SW_MAX;

    // the blade sweeps freely through stone (full 360s). With right-click held, the tip bites in
    // the moment it meets rock, and you pivot on it.
    const N = 2, h = dt / N, reach = sw.rDes + sw.len;
    for (let i = 0; i < N; i++) {
      const diff = angDiff(sw.ang, target);
      sw.av += (diff * SW_K - sw.av * SW_C) * h;
      sw.av = clamp(sw.av, -maxAV, maxAV);
      const na = sw.ang + sw.av * h;
      const g = this.swordGeom(sh.x, sh.y, na, sw.rDes);
      if (this.bladeBlocked(g, this.swordGeom(sh.x, sh.y, sw.ang, sw.r))) { sw.av *= -0.35; continue; }
      const fs = rayFirstSolid(G.level, sh.x, sh.y, na, 6, reach);
      const inRock = fs <= reach;
      if (inRock && this.wantPlant && fs >= sw.len - 1) { // only the tip has reached the stone
        sw.ang = na; sw.r = sw.rDes;
        this.plantAt(sh, na, fs);
        break;
      }
      if (inRock && !sw.inRock) this.bladeScrape(sh, na, fs);
      sw.inRock = inRock;
      sw.ang = na; sw.r = sw.rDes;
      this.checkSwordHits(g);
    }
    if (this.planted) {
      const a = this.planted;
      sw.ang = Math.atan2(a.y - sh.y, a.x - sh.x); sw.av = 0;
      sw.r = clamp(Math.hypot(a.x - sh.x, a.y - sh.y) - sw.len, SW_RMIN, SW_RMAX + 2);
    }
    const g = this.swordGeom(sh.x, sh.y, sw.ang, sw.r);
    this.applyGeom(g);
    sw.speed = Math.hypot(g.tx - ptx, g.ty - pty) / dt;
    if (sw.speed > 5000) sw.speed = 0; // teleport guard (respawn etc)
    sw.trail.push({ bx: g.bx, by: g.by, tx: g.tx, ty: g.ty, t: G.time, s: Math.abs(sw.av) });
    while (sw.trail.length && G.time - sw.trail[0].t > 0.085) sw.trail.shift();
    Sound.whoosh(Math.abs(sw.av) * (sw.r + sw.len));
  }

  // the blade slices into rock mid-swing: a spray of sparks and grit where it enters (it keeps going)
  bladeScrape(sh, ang, fs) {
    const sw = this.sword;
    const tipSpeed = Math.abs(sw.av) * (sw.rDes + sw.len);
    if (tipSpeed < 450 || sw.clangCD > 0) return;
    const px = sh.x + Math.cos(ang) * fs, py = sh.y + Math.sin(ang) * fs;
    const along = ang + (sw.av > 0 ? Math.PI / 2 : -Math.PI / 2);
    FX.spark(px, py, 8, along + Math.PI, 1.6, 380);
    FX.debris(px, py, 3, G.level.pal.rockLight);
    Sound.scrape(); sw.clangCD = 0.08;
  }

  // enemy / rival blades are solid to ours (unless they were already overlapping, so nothing locks up)
  bladeBlocked(g, cur) {
    const av = Math.abs(this.sword.av);
    for (const e of G.enemies) {
      if (e.dead || !e.blades) continue;
      for (const b of e.blades) {
        if (!b.solid || !b.init) continue;
        const rr = 3 + b.r;
        if (segSegDist(g.bx, g.by, g.tx, g.ty, b.ax, b.ay, b.bx, b.by) < rr &&
            segSegDist(cur.bx, cur.by, cur.tx, cur.ty, b.ax, b.ay, b.bx, b.by) >= rr) {
          G.bladeClash(this, e, b, av);
          return true;
        }
      }
    }
    if (G.mode === 'pvp') {
      for (const r of Net.remotes.values()) {
        if (!r.bladeLive()) continue;
        if (segSegDist(g.bx, g.by, g.tx, g.ty, r.bx, r.by, r.tx, r.ty) < 6 &&
            segSegDist(cur.bx, cur.by, cur.tx, cur.ty, r.bx, r.by, r.tx, r.ty) >= 6) {
          Net.clash(this, r, g);
          return true;
        }
      }
    }
    return false;
  }

  checkSwordHits(g) {
    const sw = this.sword;
    const tipSpeed = Math.abs(sw.av) * (sw.r + sw.len * 0.85) + Math.hypot(this.vx, this.vy) * 0.4;
    const d = sgn(sw.av);
    if (this.bladeStrike(g, tipSpeed, -Math.sin(sw.ang) * d, Math.cos(sw.ang) * d)) sw.av *= 0.72;
  }
  // a blade segment g {bx,by,tx,ty} moving at `speed` along (dirx, diry) cuts whatever it touches.
  // Returns true if it landed a hit. Used by the swung blade and the thrown one.
  bladeStrike(g, speed, dirx, diry, minDmg = 1) {
    let dmg = Math.max(minDmg, speed > 2600 ? 3 : speed > 1500 ? 2 : 1);
    let landed = false;
    const ripost = () => { // a hit inside the riposte window after a parry is always a critical
      if (this.riposte <= 0) return;
      this.riposte = 0; dmg = 3;
      FX.text(this.x, this.y - 70, 'RIPOSTE!', '#ffd76a', 24);
      Sound.riposte(); G.slowmo(0.25, 0.3); G.flash = Math.max(G.flash, 0.15);
    };
    for (const e of G.enemies) {
      if (e.dead || !e.hittable || e.swordCD > 0) continue;
      for (const hb of e.hurtboxes()) {
        const t = segRect(g.bx, g.by, g.tx, g.ty, hb);
        if (t < 0) continue;
        const hx = lerp(g.bx, g.tx, t), hy = lerp(g.by, g.ty, t);
        if (speed > 430) {
          ripost();
          e.swordCD = 0.2;
          e.takeHit(dmg, dirx, diry, hx, hy, speed, null);
          landed = true;
          G.hitstop = Math.max(G.hitstop, 0.03 + dmg * 0.02);
          G.shake(2 + dmg * 2);
        } else if (!e.isBoss) {
          e.vx += sgn(e.x - this.x) * 18;
        }
        break;
      }
    }
    if (G.mode !== 'pvp' || speed <= 430) return landed;
    for (const r of Net.remotes.values()) {
      if (!r.vulnerable() || r.hitCD > 0) continue;
      const t = segRect(g.bx, g.by, g.tx, g.ty, r.hurtbox());
      if (t < 0) continue;
      const hx = lerp(g.bx, g.tx, t), hy = lerp(g.by, g.ty, t);
      ripost();
      r.hitCD = 0.3;
      Net.send({ t: 'hit', to: r.id, dmg, kx: Math.round(dirx * (380 + dmg * 170)), ky: Math.round(Math.min(-250, diry * 300) - dmg * 80), x: Math.round(hx), y: Math.round(hy) });
      landed = true;
      G.hitstop = Math.max(G.hitstop, 0.03);
      G.shake(2 + dmg * 2);
      // predicted feedback: show the cut now instead of waiting a round trip for the victim's reply
      FX.spark(hx, hy, 6, null, TAU, 300);
      FX.blood(hx, hy, 8 + dmg * 4, dirx, diry);
      Sound.slash(dmg);
    }
    return landed;
  }

  // a successful parry opens a short riposte window (longer for a perfect, early parry)
  gainRiposte(perfect) {
    this.riposte = perfect ? 1.0 : 0.7;
    if (perfect) FX.text(this.x, this.y - 88, 'PERFECT', '#ffd76a', 18);
  }

  // ---- kick: no damage, but a big shove. Ring-outs into pits and spikes count as kills ----
  kick() {
    this.kickCD = 0.65; this.kickT = 0.22;
    Sound.swing();
    const f = this.facing;
    const box = { x: f > 0 ? this.x + 4 : this.x - 50, y: this.y - 14, w: 46, h: 42 };
    let landed = false;
    for (const e of G.enemies) {
      if (e.dead || !e.hittable || !e.kicked) continue;
      if (e.hurtboxes().some((hb) => rectsOverlap(hb, box))) { e.kicked(f); landed = true; }
    }
    if (G.mode === 'pvp') {
      for (const r of Net.remotes.values()) {
        if (!r.vulnerable() || !rectsOverlap(r.hurtbox(), box)) continue;
        Net.send({ t: 'kick', to: r.id, kx: f * 560, ky: -360 });
        landed = true;
      }
    }
    if (landed) {
      Sound.kick(); G.shake(6); G.hitstop = Math.max(G.hitstop, 0.05);
      FX.dust(this.x + f * 34, this.y + 6, 8, 'rgba(255,255,255,0.6)', 200);
      FX.ring(this.x + f * 34, this.y + 6, 4, 40, '#ffffff', 0.25, 3);
      FX.text(this.x + f * 40, this.y - 30, 'KICK!', '#ffffff', 16);
    }
  }
  // knocked down by a kick (no damage). Knockback grows the more hurt you are.
  kicked(kx, ky, src, attackerId) {
    if (this.dead || this.rag || this.invuln > 0 || this.dashT > 0) return false;
    const k = 1 + (this.maxHp - this.hp) * 0.35;
    if (attackerId) this.lastAttacker = { id: attackerId, t: G.time };
    G.lastHitBy = src;
    Sound.kick(); G.shake(8);
    this.unplant(); this.stun = 0;
    this.rag = new Ragdoll(this.pose, clamp(kx * k, -1600, 1600), clamp(ky * k, -1400, 600), rand(-5, 5));
    this.ragT = 0.55;
    return true;
  }

  // ---- throw the katana (left click), click again to call it back ----
  throwSword() {
    const sw = this.sword;
    if (this.ki < 20) { FX.text(this.x, this.y - 54, 'no ki', '#9fd8ff', 13); return; }
    this.ki -= 20;
    const sh = this.shoulder();
    const a = Math.atan2(G.mouse.y - sh.y, G.mouse.x - sh.x);
    const sp = 1250;
    this.thrown = {
      x: sw.hx + Math.cos(a) * 40, y: sw.hy + Math.sin(a) * 40,
      vx: Math.cos(a) * sp + this.vx * 0.5, vy: Math.sin(a) * sp + this.vy * 0.3,
      ang: sw.ang, spin: (Math.cos(a) >= 0 ? 1 : -1) * 26, stuck: false, back: false, t: 0, hitCD: 0,
    };
    this.unplant();
    Sound.throwBlade();
    FX.ring(sw.hx, sw.hy, 4, 30, '#bff6ff', 0.2, 2);
  }
  recall() {
    const th = this.thrown;
    if (!th || th.back) return;
    th.back = true; th.stuck = false; th.t = 0;
    Sound.throwBlade();
    FX.spark(th.x, th.y, 6, null, TAU, 250);
  }
  catchSword() {
    const sw = this.sword, th = this.thrown;
    this.thrown = null;
    sw.ang = Math.atan2(th.vy, th.vx) + Math.PI; sw.av = 0;
    this.placeSword();
    Sound.catchBlade();
    FX.ring(sw.hx, sw.hy, 4, 26, '#ffffff', 0.2, 2);
  }
  updateThrown(dt, I) {
    const th = this.thrown, L = G.level, sw = this.sword;
    th.t += dt; th.hitCD -= dt;
    const hand = this.rag ? this.pose.hF : this.shoulder();
    if (th.back) {
      // fly home to the hand, cutting everything on the way
      const dx = hand.x - th.x, dy = hand.y - th.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(1500, 500 + th.t * 2500);
      th.vx = lerp(th.vx, (dx / d) * sp, Math.min(1, dt * 10)); th.vy = lerp(th.vy, (dy / d) * sp, Math.min(1, dt * 10));
      th.x += th.vx * dt; th.y += th.vy * dt; th.ang += th.spin * dt;
      if (d < 34 && !this.rag && !this.dead) { this.catchSword(); return; }
    } else if (!th.stuck) {
      th.vy = Math.min(th.vy + 900 * dt, 1400);
      th.x += th.vx * dt; th.y += th.vy * dt; th.ang += th.spin * dt;
      const sp = Math.hypot(th.vx, th.vy), dirA = Math.atan2(th.vy, th.vx);
      const tipX = th.x + Math.cos(dirA) * 22, tipY = th.y + Math.sin(dirA) * 22;
      if (L.solidAt(tipX, tipY)) { // bites into the stone point-first
        th.stuck = true; th.ang = dirA + Math.PI; th.vx = th.vy = 0;
        Sound.plant(); FX.spark(tipX, tipY, 10, dirA + Math.PI, 2, 350); FX.dust(tipX, tipY, 4);
      } else if (th.y > L.height + 200 || th.x < -200 || th.x > L.width + 200) {
        th.back = true; th.t = 0; // lost over the edge: it comes home on its own
      }
      if (sp < 1) th.stuck = true;
    } else {
      // stuck in rock: walk over it to pick it up
      if (!this.rag && !this.dead && Math.hypot(this.x - th.x, this.y - th.y) < 40) { this.catchSword(); return; }
    }
    // the spinning blade is a weapon while it flies
    const c = Math.cos(th.ang), s = Math.sin(th.ang);
    sw.hx = th.x - c * 40; sw.hy = th.y - s * 40;
    sw.bx = th.x - c * 30; sw.by = th.y - s * 30; sw.tx = th.x + c * 40; sw.ty = th.y + s * 40;
    sw.ang = th.ang;
    if (!th.stuck && th.hitCD <= 0) {
      const sp = Math.hypot(th.vx, th.vy);
      if (this.bladeStrike(sw, Math.max(sp, 900), th.vx / (sp || 1), th.vy / (sp || 1), th.back ? 1 : 2)) {
        th.hitCD = 0.15;
        if (!th.back) { th.vx *= -0.3; th.vy = -260; } // bounces off whoever it cut
      }
    }
  }

  // ---- damage / ragdoll ----
  hurt(dmg, kx, ky, src, attackerId) {
    if (this.dead || this.rag || this.invuln > 0 || this.dashT > 0) return false;
    this.hp -= dmg;
    G.lastHitBy = src;
    if (attackerId) this.lastAttacker = { id: attackerId, t: G.time };
    Sound.hurt(); G.shake(10); G.hitstop = Math.max(G.hitstop, 0.09);
    FX.blood(this.x, this.y - 10, 14, kx, ky);
    FX.text(this.x, this.y - 50, pick(['OOF', 'AGH', 'OW', 'ACK', 'HNNG', 'WAH']), '#ff8080', 18);
    this.unplant(); this.dashT = 0; this.stun = 0;
    this.rag = new Ragdoll(this.pose, this.vx * 0.3 + kx, this.vy * 0.2 + ky, rand(-6, 6));
    this.ragT = 0.65 + dmg * 0.2;
    if (this.hp <= 0) { this.hp = 0; this.die(src); }
    return true;
  }
  die(src) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.hp = 0;
    G.lastHitBy = src || G.lastHitBy;
    if (!this.rag) this.rag = new Ragdoll(this.pose, this.vx, this.vy - 200, rand(-4, 4));
    this.unplant();
    Sound.pdeath(); G.slowmo(0.3, 1.0); G.shake(14);
    Sound.whoosh(0);
    if (G.mode === 'pvp' && !this.reported) {
      this.reported = true;
      const la = this.lastAttacker;
      Net.send({ t: 'died', killer: la && G.time - la.t < 6 ? la.id : 0, cause: src || '' });
    }
  }
  getParried(x, y) {
    if (this.dead || this.rag) return;
    this.stun = 0.75;
    this.sword.av = (Math.random() < 0.5 ? -1 : 1) * 28;
    FX.parryBurst(x, y, 1); Sound.parry(); G.shake(8);
    FX.text(this.x, this.y - 66, 'PARRIED!', '#ff9090', 18);
  }
  netFlags() {
    return (this.rag ? 1 : 0) | (this.dead ? 2 : 0) | (this.dashT > 0 ? 4 : 0) | (this.planted ? 8 : 0) |
      (this.winded ? 16 : 0) | (this.invuln > 0 && !this.rag ? 32 : 0) | (this.stun > 0 ? 64 : 0) |
      (this.thrown ? 128 : 0) | (this.riposte > 0 ? 256 : 0);
  }
  ragSword() {
    const sw = this.sword, p = this.pose;
    sw.ang = fitBladeAngle(G.level, p.hF.x, p.hF.y, Math.atan2(p.hF.y - p.eF.y, p.hF.x - p.eF.x), sw.len);
    sw.av = 0; sw.trail.length = 0;
    const c = Math.cos(sw.ang), s = Math.sin(sw.ang);
    sw.hx = p.hF.x; sw.hy = p.hF.y;
    sw.bx = sw.hx + c * sw.base; sw.by = sw.hy + s * sw.base;
    sw.tx = sw.hx + c * sw.len; sw.ty = sw.hy + s * sw.len;
  }
  updateRagdoll(dt) {
    const L = G.level;
    this.rag.update(dt, L); this.rag.toPose(this.pose); if (!this.thrown) this.ragSword();
    Sound.whoosh(0);
    this.ragT -= dt;
    const hip = this.rag.p.hip;
    if (hip.y > L.height + 120) { this.die('the abyss'); return; }
    if (this.ragT <= 0 && (this.rag.speed() < 260 || this.ragT < -0.6)) {
      // stand up in open air nearest the hip (never inside a wall the ragdoll got wedged against)
      let fx = hip.x, fy = hip.y;
      search: for (let r = 0; r <= 200; r += 8) {
        for (const [dx, dy] of [[0, -r], [-r, 0], [r, 0], [-r, -r], [r, -r], [0, r]]) {
          if (!L.boxSolid(hip.x + dx, hip.y + dy, this.w, this.h)) { fx = hip.x + dx; fy = hip.y + dy; break search; }
        }
      }
      const gy = L.groundBelow(fx, fy, 4);
      if (gy !== null && !L.boxSolid(fx, gy - this.h / 2 - 0.5, this.w, this.h)) fy = gy - this.h / 2 - 0.5;
      this.x = fx; this.y = fy;
      this.vx = 0; this.vy = 0;
      copyPose(this.snapPose, this.pose);
      this.rag = null; this.getupT = 0.22; this.invuln = 1.0;
      this.band1.reset(this.pose.head.x, this.pose.head.y); this.band2.reset(this.pose.head.x, this.pose.head.y);
      FX.dust(this.x, this.y + 26, 5);
      this.placeSword();
    }
    this.updateBands();
  }

  buildPose() {
    const sw = this.sword;
    const run = this.grounded ? clamp(Math.abs(this.vx) / RUN_SPEED, 0, 1.3) : 0;
    standPose(this.getupT > 0 ? this.tmpPose : this.pose, {
      x: this.x, footY: this.y + this.h / 2, facing: this.facing, s: 1, phase: this.phase, run,
      air: !this.grounded && !this.planted, vy: this.vy, lean: this.kickT > 0 ? -0.25 : this.lean, crouch: this.planted ? 3 : 0,
      hF: this.thrown ? null : { x: sw.hx, y: sw.hy },
    });
    if (this.getupT > 0) lerpPose(this.pose, this.snapPose, this.tmpPose, 1 - this.getupT / 0.22);
    if (this.kickT > 0) { // front leg snaps out straight
      const p = this.pose, f = this.facing, ext = Math.sin(clamp(this.kickT / 0.22, 0, 1) * Math.PI);
      p.fF.x = p.hip.x + f * (12 + 22 * ext); p.fF.y = p.hip.y + 22 - 16 * ext;
      const k = ik2(p.hip.x, p.hip.y, p.fF.x, p.fF.y, 13, 13, -f); p.kF.x = k.x; p.kF.y = k.y;
    }
    this.updateBands();
  }
  updateBands() {
    const h = this.pose.head, f = this.rag ? 1 : this.facing;
    const w = (G.wind || 0) * 0.0004 - this.vx * 0.0003;
    this.band1.update(h.x - f * 6, h.y - 3, w);
    this.band2.update(h.x - f * 6, h.y - 1, w * 0.8);
  }

  draw(ctx) {
    const sw = this.sword;
    for (const g of this.ghosts) {
      ctx.globalAlpha = g.a * 0.35;
      drawFigure(ctx, g.pose, this.style, g.f, true);
    }
    ctx.globalAlpha = 1;
    const blink = this.invuln > 0 && !this.rag && !this.dead && Math.floor(G.time * 18) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    this.band2.draw(ctx, shade(this.style.band, -0.2), 2.4);
    this.band1.draw(ctx, this.style.band, 2.8);
    drawFigure(ctx, this.pose, this.style, this.rag ? sgn(this.pose.head.x - this.pose.hip.x) : this.facing, false);
    drawSlashTrail(ctx, sw.trail);
    if (this.thrown && !this.thrown.stuck) drawSpinBlur(ctx, this.thrown.x, this.thrown.y);
    const glow = this.riposte > 0 ? '#ffd76a' : Math.abs(sw.av) > 26 ? '#bff6ff' : null;
    drawKatana(ctx, sw.hx, sw.hy, sw.ang, sw.len, 1, this.style, glow);
    if (this.winded && !this.rag && !this.dead) {
      ctx.fillStyle = '#9fd8ff';
      for (let i = 0; i < 2; i++) {
        const t = (G.time * 1.6 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - t;
        ctx.beginPath(); ctx.ellipse(this.pose.head.x + (i ? 9 : -9), this.pose.head.y - 4 + t * 14, 1.8, 3, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (this.stun > 0 && !this.rag && !this.dead) drawStars(ctx, this.pose.head.x, this.pose.head.y - 14, G.time);
  }
}

// faint disc behind a spinning thrown blade
function drawSpinBlur(ctx, x, y) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(200,245,255,0.12)';
  ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// additive afterimage of a fast blade; trail entries are {bx,by,tx,ty,s}
function drawSlashTrail(ctx, trail) {
  if (trail.length < 3) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i];
    const k = clamp((b.s - 9) / 22, 0, 1) * (i / trail.length);
    if (k <= 0.02) continue;
    ctx.fillStyle = `rgba(200,245,255,${k * 0.45})`;
    ctx.beginPath(); ctx.moveTo(a.bx, a.by); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b.bx, b.by); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
