'use strict';
// The samurai. The katana is a physically simulated blade pulled toward the mouse by a torque-limited
// spring. Stone stops it: only the tip may sink in (SW_ALLOW px). That tip is what you plant
// (right-click) and pivot around.
const SW_K = 950, SW_C = 46, SW_MAX = 34;
const SW_ALLOW = 6;               // how deep the tip may bite into stone
const SW_RMIN = 4, SW_RMAX = 20;  // how far the hand reaches from the shoulder
const RUN_SPEED = 275, JUMP_V = 720, DJUMP_V = 660, DASH_V = 950, DASH_T = 0.16;
const PIVOT_K = 5200;             // how hard the mouse swings you around a planted blade
const NO_INPUT = { down: () => false, take: () => false, mr: false, ml: false };
// iai balance: a full charge is lethal (4 dmg, dismembers on a kill), but it's slow to charge, costly,
// on a cooldown, parryable by a fast counter-swing, and a whiff leaves you wide open
const IAI_MIN = 0.45, IAI_KI = 35, IAI_CHARGE = 0.8, IAI_STRIKE = 0.15, IAI_RECOVER = 0.4, IAI_WHIFF = 0.8, IAI_CD = 1.4;

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
    this.kickT = 0; this.kickCD = 0; this.riposte = 0; this.iai = null; this.iaiCD = 0; this.noCutT = 0;
    this.style = style || STYLES.player;
    this.sword = { ang: -0.4, av: 0, r: 12, rDes: 12, len: 80, base: 10, hx: x, hy: y, bx: x, by: y, tx: x, ty: y, speed: 0, clangCD: 0, trail: [] };
    this.band1 = new Rope(7, 4.5, x, y - 30); this.band2 = new Rope(6, 4.2, x, y - 30);
    this.placeSword();
    this.buildPose();
  }

  get bladeOut() { return !(this.iai && this.iai.phase === 'charge'); } // sheathed while charging an iai
  shoulder() { return { x: this.x + this.facing * (1 + this.lean * 8), y: this.y - 15 + Math.abs(this.lean) * 2 }; }
  hurtbox() { return { x: this.x - 9, y: this.y - 24, w: 18, h: 50 }; }

  swordGeom(sx, sy, ang, r) {
    const sw = this.sword, c = Math.cos(ang), s = Math.sin(ang);
    return { hx: sx + c * r, hy: sy + s * r, bx: sx + c * (r + sw.base), by: sy + s * (r + sw.base), tx: sx + c * (r + sw.len), ty: sy + s * (r + sw.len) };
  }
  applyGeom(g) { const sw = this.sword; sw.hx = g.hx; sw.hy = g.hy; sw.bx = g.bx; sw.by = g.by; sw.tx = g.tx; sw.ty = g.ty; }
  placeSword() {
    const sh = this.shoulder();
    this.applyGeom(this.swordGeom(sh.x, sh.y, this.sword.ang, this.sword.r));
  }

  // ------------------------------------------------------------------
  update(dt) {
    const L = G.level, sw = this.sword;
    const I = G.inputBlocked ? NO_INPUT : Input;
    sw.clangCD -= dt; this.invuln -= dt; this.dashCD -= dt; this.plantCD -= dt; this.pogoCD -= dt; this.getupT -= dt; this.stun -= dt;
    this.kickCD -= dt; this.kickT -= dt; this.riposte -= dt; this.noCutT -= dt;

    sw.blood = Math.max(0, (sw.blood || 0) - dt * 0.05);
    if (sw.blood > 0.15 && Settings.gore && Math.random() < sw.blood * 0.03) { // drips off the tip
      FX.add({ t: 'blob', x: sw.tx, y: sw.ty, vx: rand(-15, 15), vy: 20, life: 1.5, max: 1.5, col: '#9e0f1e', grav: 1400, size: rand(1.2, 2) });
    }
    if (this.dead) {
      this.deadT += dt;
      this.rag.update(dt, L); this.rag.toPose(this.pose); this.ragSword();
      const cut = this.rag.cut;
      bleed(this.pose, cut, this.deadT, '#b3122a', 1, dt);
      if (cut & CUT.head) {
        const q = this.rag.p.head, sp = Math.hypot(q.x - q.ox, q.y - q.oy) / STEP;
        this.headSpin = (this.headSpin === undefined ? rand(-16, 16) : this.headSpin) * (sp < 40 ? 0.85 : 0.995);
        this.headAng = (this.headAng || 0) + this.headSpin * dt;
      }
      return;
    }
    // badly hurt: you leave a trail of blood
    if (this.hp <= 2 && Settings.gore && Math.random() < (this.hp === 1 ? 26 : 12) * dt) {
      FX.add({ t: 'blob', x: this.x + rand(-6, 6), y: this.y + rand(-14, 8), vx: rand(-30, 30) + this.vx * 0.4, vy: rand(-40, 10), life: 1.5, max: 1.5, col: '#b3122a', grav: 1400, size: rand(1.2, 2.4) });
    }
    if (this.rag) { this.updateRagdoll(dt); return; }

    // ---- kick (F) and the iai draw-cut (hold / release left click) ----
    if (I.take('KeyF') && this.kickCD <= 0 && !(this.iai && this.iai.phase === 'strike')) this.kick();
    this.updateIai(dt, I);
    I.take('Mouse0');
    const striking = this.iai && this.iai.phase === 'strike', charging = this.iai && this.iai.phase === 'charge';

    const ix = (I.down('KeyD', 'ArrowRight') ? 1 : 0) - (I.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const iy = (I.down('KeyS', 'ArrowDown') ? 1 : 0) - (I.down('KeyW', 'ArrowUp') ? 1 : 0);
    if (I.take('Space')) this.jumpBuf = 0.13;
    if (I.take('ShiftLeft', 'ShiftRight')) this.dashBuf = 0.12;
    this.jumpBuf -= dt; this.dashBuf -= dt;
    if (this.dashT <= 0) this.facing = G.mouse.x >= this.x ? 1 : -1;

    // ---- plant the blade tip (hold right mouse) ----
    this.wantPlant = I.mr && !this.planted && this.plantCD <= 0 && !this.iai;
    if (this.wantPlant) this.tryPlant();
    if (this.planted && !I.mr) this.unplant();

    const wasGround = this.grounded;
    if (this.planted) {
      this.updatePlanted(dt, ix, I);
    } else {
      // ---- dash ----
      if (striking) {
        // committed to the draw-cut: the dash carries you (no gravity, no steering)
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.02; this.ghosts.push({ pose: copyPose(newPose(), this.pose), f: this.facing, a: 1 }); }
      } else if (this.dashBuf > 0 && this.dashCD <= 0 && !charging && (this.grounded || this.airDash > 0)) {
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
      if (striking) {
        /* velocity set by startIai */
      } else if (this.dashT > 0) {
        this.dashT -= dt;
        this.vx = this.dashX * DASH_V; this.vy = this.dashY * DASH_V;
        if (this.dashT <= 0) { this.vx *= 0.45; this.vy *= 0.3; }
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.025; this.ghosts.push({ pose: copyPose(newPose(), this.pose), f: this.facing, a: 1 }); }
      } else {
        // ---- run ----
        const wind = G.wind || 0;
        const target = ix * RUN_SPEED * (charging ? 0.4 : 1) + wind * (this.grounded ? 1 : 0.8);
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

    if (this.iai && this.iai.phase !== 'recover') { this.iaiSword(dt); return; }

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
    const maxAV = this.stun > 0 ? 4 : this.iai ? 6 : this.winded ? 11 : SW_MAX; // sluggish while recovering from an iai

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
    if (this.noCutT > 0) return; // re-drawing the blade after an iai: it can't cut yet
    const sw = this.sword;
    const tipSpeed = Math.abs(sw.av) * (sw.r + sw.len * 0.85) + Math.hypot(this.vx, this.vy) * 0.4;
    const d = sgn(sw.av);
    if (this.bladeStrike(g, tipSpeed, -Math.sin(sw.ang) * d, Math.cos(sw.ang) * d)) sw.av *= 0.72;
  }
  // a blade segment g {bx,by,tx,ty} moving at `speed` along (dirx, diry) cuts whatever it touches.
  // Returns true if it landed a hit. Used by the swung blade and the iai draw-cut.
  bladeStrike(g, speed, dirx, diry, minDmg = 1) {
    let dmg = Math.max(minDmg, speed > 2600 ? 3 : speed > 1500 ? 2 : 1);
    let landed = false;
    const ripost = () => { // a hit inside the riposte window after a parry is always a critical
      if (this.riposte <= 0) return;
      this.riposte = 0; dmg = Math.max(dmg, 3);
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
          landed = true; this.sword.blood = Math.min(1, (this.sword.blood || 0) + 0.35);
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
      landed = true; this.sword.blood = Math.min(1, (this.sword.blood || 0) + 0.35);
      G.hitstop = Math.max(G.hitstop, 0.03);
      G.shake(2 + dmg * 2);
      // predicted feedback: show the cut now instead of waiting a round trip for the victim's reply
      FX.spark(hx, hy, 6, null, TAU, 300);
      FX.blood(hx, hy, 18 + dmg * 8, dirx, diry);
      if (Math.hypot(r.x - this.x, r.y - this.y) < 150 && dmg >= 2) FX.screenSplat(1);
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
    this.unplant(); this.stun = 0; this.iai = null;
    this.rag = new Ragdoll(this.pose, clamp(kx * k, -1600, 1600), clamp(ky * k, -1400, 600), rand(-5, 5));
    this.ragT = 0.55;
    return true;
  }

  // ---- iai draw-cut: hold left click to sheathe and charge, release to dash-cut toward the cursor ----
  // Charging is slow and defenceless (no swinging or parrying) and visible to everyone; the cut is a
  // committed dash that hits for 2, or a guaranteed 3 at full charge, then leaves you briefly exposed.
  updateIai(dt, I) {
    const z = this.iai;
    if (!z) {
      this.iaiCD -= dt;
      if (I.ml && !this.planted && this.stun <= 0 && this.dashT <= 0 && this.iaiCD <= 0) {
        if (this.ki < IAI_KI) { if (I.take('Mouse0')) FX.text(this.x, this.y - 54, 'no ki', '#9fd8ff', 13); return; }
        this.iai = { phase: 'charge', t: 0, charge: 0, glint: false };
        Sound.swing();
      }
      return;
    }
    z.t += dt;
    if (z.phase === 'charge') {
      z.charge = Math.min(1, z.t / IAI_CHARGE);
      if (z.charge >= 1 && !z.glint) { z.glint = true; FX.glint(this.x + this.facing * 12, this.y + 2, '#ffffff', 36); Sound.shing(); }
      if (!I.ml) {
        // tapped / released too early: the blade goes back without cutting (no free snap-back swing)
        if (z.charge < IAI_MIN) { this.iai = null; this.noCutT = 0.4; this.iaiCD = 0.45; return; }
        this.startIai();
      }
    } else if (z.phase === 'strike') {
      if (z.t >= IAI_STRIKE || this.hitWall) {
        z.phase = 'recover'; z.t = 0; this.vx *= 0.25; this.vy *= 0.25;
        this.iaiCD = IAI_CD; this.noCutT = (z.hit ? IAI_RECOVER : IAI_WHIFF) + 0.15;
        if (!z.hit) FX.text(this.x, this.y - 54, 'overextended', '#ffb0a0', 13); // a whiff leaves you open longer
      }
    } else if (z.t >= (z.hit ? IAI_RECOVER : IAI_WHIFF)) this.iai = null;
  }
  startIai() {
    const z = this.iai, sh = this.shoulder();
    const a = Math.atan2(G.mouse.y - sh.y, G.mouse.x - sh.x);
    z.phase = 'strike'; z.t = 0; z.dir = a; z.side = Math.cos(a) >= 0 ? 1 : -1;
    z.from = a + z.side * 2.4; z.to = a - z.side * 0.5; // a rising cut from the hip, through the target, up
    this.facing = z.side;
    this.ki -= IAI_KI;
    const sp = 700 + 700 * z.charge;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.8;
    this.unplant();
    Sound.dash(); Sound.counterCut();
    FX.ring(this.x, this.y, 6, 50, z.charge >= 1 ? '#ffd76a' : '#ffffff', 0.25, 3);
  }
  iaiSword(dt) { // the blade during the iai, replacing the normal mouse-driven swing
    const z = this.iai, sw = this.sword, sh = this.shoulder();
    if (z.phase === 'charge') {
      // drawn back to the hip, ready
      const want = this.facing > 0 ? 2.5 : Math.PI - 2.5;
      sw.ang += angDiff(sw.ang, want) * Math.min(1, dt * 18); sw.av = 0; sw.r = SW_RMIN + 2; sw.rDes = sw.r;
      this.applyGeom(this.swordGeom(sh.x, sh.y, sw.ang, sw.r));
      sw.trail.length = 0;
      return;
    }
    const k = clamp(z.t / IAI_STRIKE, 0, 1);
    const prev = sw.ang;
    sw.ang = lerp(z.from, z.to, easeOut(k)); sw.r = SW_RMAX; sw.rDes = SW_RMAX;
    sw.av = angDiff(prev, sw.ang) / dt;
    const g = this.swordGeom(sh.x, sh.y, sw.ang, sw.r);
    this.applyGeom(g);
    this.bladeBlocked(g, this.swordGeom(sh.x, sh.y, prev, sw.r)); // enemy blades in the way get parried
    const c = Math.cos(z.dir), s = Math.sin(z.dir);
    // 2 damage for a quick draw, 3 past 60% charge, 4 at full (and 3+ always dismembers on a kill)
    if (this.bladeStrike(g, 2600, c, s, z.charge >= 1 ? 4 : z.charge >= 0.6 ? 3 : 2)) z.hit = true;
    sw.trail.push({ bx: g.bx, by: g.by, tx: g.tx, ty: g.ty, t: G.time, s: 34 });
    while (sw.trail.length && G.time - sw.trail[0].t > 0.12) sw.trail.shift();
    Sound.whoosh(2600);
  }

  // ---- damage / ragdoll ----
  // cutAt: where a blade struck {x, y}; a killing blade blow can take a limb or the head
  hurt(dmg, kx, ky, src, attackerId, cutAt) {
    if (this.dead || this.rag || this.invuln > 0 || this.dashT > 0) return false;
    this.hp -= dmg;
    G.lastHitBy = src;
    if (attackerId) this.lastAttacker = { id: attackerId, t: G.time };
    Sound.hurt(); G.shake(10); G.hitstop = Math.max(G.hitstop, 0.09);
    const at = cutAt || { x: this.x, y: this.y - 10 };
    FX.blood(at.x, at.y, 26, kx, ky);
    FX.screenSplat(1 + dmg);
    const pose0 = copyPose(newPose(), this.pose);
    FX.text(this.x, this.y - 50, pick(['OOF', 'AGH', 'OW', 'ACK', 'HNNG', 'WAH']), '#ff8080', 18);
    this.unplant(); this.dashT = 0; this.stun = 0; this.iai = null;
    this.rag = new Ragdoll(this.pose, this.vx * 0.3 + kx, this.vy * 0.2 + ky, rand(-6, 6));
    this.ragT = 0.65 + dmg * 0.2;
    if (this.hp <= 0) {
      this.hp = 0; this.die(src);
      const part = cutAt ? pickSever(pose0, cutAt.x, cutAt.y, dmg, false) : null;
      const l = Math.hypot(kx, ky) || 1;
      if (part && this.rag.sever(part, (kx / l) * 420, -300)) {
        FX.blood(at.x, at.y, 30, kx, ky);
        if (part === 'head') FX.text(this.x, this.y - 64, 'DECAPITATED', '#ff5a5a', 20);
      }
    }
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
  // a guarding samurai caught the draw-cut on his blade: you bounce off, staggered and exposed
  iaiBlocked(e) {
    if (!this.iai) return;
    const z = this.iai;
    this.iai = null; this.iaiCD = IAI_CD; this.noCutT = 0.6;
    this.stun = 0.6; this.vx = -Math.cos(z.dir || 0) * 320; this.vy = -160;
    const x = (this.x + e.x) / 2, y = Math.min(this.y, e.y) - 10;
    Sound.clang(1); FX.spark(x, y, 22, null, TAU, 600); G.shake(8); G.hitstop = Math.max(G.hitstop, 0.06);
    FX.text(e.x, e.y - 50, 'BLOCKED!', '#ffffff', 18);
  }
  getParried(x, y) {
    if (this.dead || this.rag) return;
    const wasIai = !!this.iai;
    this.stun = wasIai ? 1.1 : 0.75; // getting your draw-cut parried is the worst place to be
    if (wasIai) { this.iai = null; this.iaiCD = IAI_CD; this.vx *= 0.2; this.vy *= 0.2; FX.text(this.x, this.y - 84, 'IAI PARRIED', '#ff9090', 16); }
    this.sword.av = (Math.random() < 0.5 ? -1 : 1) * 28;
    FX.parryBurst(x, y, 1); Sound.parry(); G.shake(8);
    FX.text(this.x, this.y - 66, 'PARRIED!', '#ff9090', 18);
  }
  netFlags() {
    return (this.rag ? 1 : 0) | (this.dead ? 2 : 0) | (this.dashT > 0 ? 4 : 0) | (this.planted ? 8 : 0) |
      (this.winded ? 16 : 0) | (this.invuln > 0 && !this.rag ? 32 : 0) | (this.stun > 0 ? 64 : 0) |
      (this.iai && this.iai.phase === 'charge' ? 128 : 0) | (this.riposte > 0 ? 256 : 0);
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
    this.rag.update(dt, L); this.rag.toPose(this.pose); this.ragSword();
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
      air: !this.grounded && !this.planted, vy: this.vy, lean: this.kickT > 0 ? -0.25 : this.lean, crouch: this.planted ? 3 : this.iai && this.iai.phase === 'charge' ? 8 : 0,
      hF: { x: sw.hx, y: sw.hy },
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
    drawFigure(ctx, this.pose, this.style, this.rag ? sgn(this.pose.head.x - this.pose.hip.x) : this.facing, false, this.rag ? this.rag.cut : 0, this.headAng === undefined ? null : this.headAng);
    drawSlashTrail(ctx, sw.trail);
    const z = this.iai;
    if (z && z.phase === 'charge' && !this.rag) drawIaiCharge(ctx, this.x, this.y, z.charge);
    const glow = this.riposte > 0 || (z && z.charge >= 1) ? '#ffd76a' : Math.abs(sw.av) > 26 ? '#bff6ff' : null;
    drawKatana(ctx, sw.hx, sw.hy, sw.ang, sw.len, 1, this.style, glow, sw.blood);
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

// gathering-energy ring while an iai charges (shared with rivals' view in duels)
function drawIaiCharge(ctx, x, y, k) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const full = k >= 1, a = full ? 0.5 + 0.3 * Math.sin(G.time * 30) : 0.25 + k * 0.25;
  ctx.strokeStyle = full ? `rgba(255,215,106,${a})` : `rgba(220,240,255,${a})`;
  ctx.lineWidth = full ? 3 : 2;
  ctx.beginPath(); ctx.arc(x, y, 46 - k * 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  ctx.restore();
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
