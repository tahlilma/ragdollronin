'use strict';
const G = {
  mode: 'story', state: 'title', stage: 0, pvpMap: 0, level: null, player: null, enemies: [], projectiles: [], corpses: [],
  cam: { x: 640, y: 360, shake: 0, sx: 0, sy: 0 }, mouse: { x: 0, y: 0 },
  time: 0, hitstop: 0, timeScale: 1, slowT: 0, slowScale: 1,
  wind: 0, windNext: 0, boss: null, bossIntro: 0, bossDeadT: -1, stageTime: 0, kills: 0,
  W: 1280, H: 720, dpr: 1, scale: 1, viewW: 1280, viewH: 720,
  bg: null, bgCache: {}, motes: [], lastHitBy: '', uiT: 0, killedBy: null, mapCard: 0,
  flash: 0, zoomKick: 0, edgeTint: null, inputBlocked: false, menuOpen: false,
  get viewTop() { return this.cam.y - this.viewH / 2; },
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); },
  // slow motion is local-only, so it's off in online duels (it would desync your own samurai)
  slowmo(sc, d) { if (this.mode === 'pvp') return; this.slowScale = sc; this.slowT = Math.max(this.slowT, d); },
  addCorpse(e, vx, vy) {
    this.corpses.push(new Corpse(e, vx, vy));
    if (this.corpses.length > 14) this.corpses.shift();
  },
  // player blade touches an enemy blade
  bladeClash(p, e, b, av) {
    if (e.clashCD > 0) return;
    e.clashCD = 0.15;
    const sw = p.sword;
    const cx = (sw.bx + sw.tx) / 2 * 0.4 + (b.ax + b.bx) / 2 * 0.6, cy = (sw.by + sw.ty) / 2 * 0.4 + (b.ay + b.by) / 2 * 0.6;
    const away = sgn(p.x - e.x);
    if (b.active && !b.hitDone && !b.cancelled) {
      if (b.heavy) {
        FX.spark(cx, cy, 16, null, TAU, 500); Sound.clang(1);
        if (p.hurt(1, away * 700, -500, e.name)) FX.text(cx, cy - 20, 'TOO HEAVY TO PARRY', '#ffb0a0', 14);
        b.hitDone = true;
        return;
      }
      if (av > 4.5 && b.parryable) {
        Sound.parry(); FX.parryBurst(cx, cy, 1);
        FX.text(cx, cy - 26, 'PARRY!', '#fff6a0', 24);
        this.slowmo(0.25, 0.35); this.shake(9); this.hitstop = Math.max(this.hitstop, 0.07);
        b.cancelled = true; b.hitDone = true; b.active = false;
        sw.av *= -0.5;
        if (e.onParried) e.onParried(b);
        // caught in the first ~70 ms of the swing: a perfect parry staggers longer
        const perfect = (b.t || 0) < 0.07;
        if (perfect) { if (e.staggerT) e.staggerT *= 1.6; if (e.stagT) e.stagT *= 1.6; }
        p.gainRiposte(perfect);
        return;
      }
      if (b.guardBreak) {
        FX.spark(cx, cy, 14, null, TAU, 500); Sound.clang(1);
        FX.text(cx, cy - 20, 'GUARD BROKEN', '#ffb0a0', 14);
        if (p.hurt(b.dmg, away * 600, -420, e.name, 0, { x: cx, y: cy })) b.hitDone = true;
        return;
      }
      Sound.clang(0.8); FX.spark(cx, cy, 12, null, TAU, 450);
      FX.text(cx, cy - 20, 'BLOCK', '#ffffff', 14);
      b.cancelled = true; b.hitDone = true; b.active = false;
      p.vx += away * 420; p.vy -= 120;
      sw.av += away * 12;
      if (e.onBlocked) e.onBlocked(b);
      return;
    }
    if (av > 3) { Sound.clang(clamp(av / 30, 0.25, 0.8)); FX.spark(cx, cy, 6, null, TAU, 300); }
    if (av > 10 && e.onGuardHit) e.onGuardHit();
  },
  onBossDefeated(b) {
    this.bossDeadT = 0;
    Music.play(STAGES[this.stage].pal);
    FX.text(b.x, b.y - 100, '討 伐', '#ffffff', 46, { life: 2.5, vy: -10, font: 'mincho' });
  },
  // ---- online duel hooks (called from net.js) ----
  onNetHit(m) {
    const p = this.player;
    if (!p || p.dead) return;
    const k = 1 + (p.maxHp - p.hp) * 0.3; // the more hurt you are, the further you fly
    if (p.hurt(m.dmg, clamp(m.kx * k, -1600, 1600), clamp(m.ky * k, -1400, 600), Net.nameOf(m.from), m.from, { x: m.x, y: m.y })) {
      Net.send({ t: 'ouch', by: m.from, dmg: m.dmg, x: Math.round(m.x), y: Math.round(m.y) });
    }
  },
  onNetKick(m) {
    const p = this.player;
    if (p && !p.dead) p.kicked(m.kx, m.ky, Net.nameOf(m.from), m.from);
  },
  newPvpMatch(map) { loadPvpMap(map); updateMouseWorld(); this.player.placeSword(); },
  onNetLost() {
    if (this.mode !== 'pvp') return;
    quitToTitle();
    setPvpMsg('Lost connection to the duel server.');
  },
};

const Save = {
  data: { unlocked: 1, deaths: [0, 0, 0, 0, 0], cleared: [false, false, false, false, false] },
  load() { try { const s = JSON.parse(localStorage.getItem('ragdoll-ronin-v1')); if (s) Object.assign(this.data, s); } catch (e) { /* no storage */ } },
  save() { try { localStorage.setItem('ragdoll-ronin-v1', JSON.stringify(this.data)); } catch (e) { /* no storage */ } },
};

// ------------------------------------------------------------------ setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let vignette = null, skyGrad = null;

function resize() {
  G.dpr = Math.min(window.devicePixelRatio || 1, 2);
  G.W = window.innerWidth; G.H = window.innerHeight;
  canvas.width = Math.round(G.W * G.dpr); canvas.height = Math.round(G.H * G.dpr);
  canvas.style.width = G.W + 'px'; canvas.style.height = G.H + 'px';
  G.scale = Math.max(G.H / 720, G.W / 1600);
  G.viewW = G.W / G.scale; G.viewH = G.H / G.scale;
  vignette = null; skyGrad = null;
}

function initMotes() {
  G.motes = [];
  for (let i = 0; i < 70; i++) G.motes.push({ x: Math.random() * 1600, y: Math.random() * 900, z: rand(0.3, 1.2), ph: rand(0, TAU) });
}

function resetWorld() {
  G.enemies = []; G.projectiles = []; G.corpses = [];
  FX.clear();
  G.boss = null; G.bossIntro = 0; G.bossDeadT = -1; G.wind = 0; G.windNext = 0;
  G.stageTime = 0; G.kills = 0; G.hitstop = 0; G.timeScale = 1; G.slowT = 0; G.lastHitBy = '';
  G.flash = 0; G.zoomKick = 0; G.killedBy = null;
  G.cam.y = 360; G.cam.shake = 0;
  initMotes();
}

// ------------------------------------------------------------------ story mode
function loadStage(i) {
  G.mode = 'story'; G.stage = i;
  const def = STAGES[i];
  const b = new Builder(18);
  def.build(b);
  const L = b.build(PALS[def.pal]);
  G.level = L;
  if (!G.bgCache[i]) G.bgCache[i] = buildBackground(L.pal, def.theme);
  G.bg = G.bgCache[i];
  skyGrad = null;
  resetWorld();
  G.player = new Player(L.start.x, L.start.y);
  for (const s of L.spawns) { const e = makeEnemy(s.type, s.x, s.y, s.opts); if (e) { G.enemies.push(e); e.update(0); } }
  G.cam.x = G.player.x;
}

// scenic, player-less view of a stage behind the title menu
function previewStage(i) {
  loadStage(i);
  G.enemies = [];
  G.state = 'title';
  G.cam.x = G.viewW / 2 + 200;
}

function startStage(i) {
  Sound.init();
  Net.disconnect();
  loadStage(i);
  G.state = 'play'; G.menuOpen = false; G.inputBlocked = false;
  showScreen(null);
  Input.clear();
  Music.play(STAGES[i].pal);
  updateMouseWorld();
  G.player.placeSword();
}

// ------------------------------------------------------------------ online / LAN duel mode
function loadPvpMap(idx) {
  const n = PVP_MAPS.length, mi = ((idx % n) + n) % n, def = PVP_MAPS[mi];
  G.mode = 'pvp'; G.pvpMap = mi;
  const b = new Builder(18);
  def.build(b);
  const L = b.build(PALS[def.pal]);
  G.level = L;
  const key = 'pvp' + mi;
  if (!G.bgCache[key]) G.bgCache[key] = buildBackground(L.pal, def.theme);
  G.bg = G.bgCache[key];
  skyGrad = null;
  resetWorld();
  const sp = pickSpawn();
  G.player = new Player(sp.x, sp.y, playerStyle(Net.color));
  G.player.invuln = 1.6;
  G.cam.x = G.player.x;
  G.mapCard = 3;
}

function pickSpawn() {
  const L = G.level, pts = L.spawnPts.length ? L.spawnPts : [L.start];
  let best = pts[0], bd = -1;
  for (const s of pts) {
    let d = 5000;
    for (const r of Net.remotes.values()) if (r.ready && !r.dead) d = Math.min(d, Math.hypot(r.x - s.x, r.y - s.y));
    d += Math.random() * 150;
    if (d > bd) { bd = d; best = s; }
  }
  return { x: best.x, y: best.y - 30 };
}

function respawnPvp() {
  const sp = pickSpawn();
  G.player = new Player(sp.x, sp.y, playerStyle(Net.color));
  G.player.invuln = 1.6;
  G.killedBy = null;
  FX.ring(sp.x, sp.y, 6, 70, '#ffffff', 0.4, 3);
}

function startPvp(map) {
  Sound.init();
  loadPvpMap(map);
  G.state = 'play'; G.menuOpen = false; G.inputBlocked = false;
  showScreen(null);
  Input.clear();
  Music.play('duel');
  updateMouseWorld();
  G.player.placeSword();
}

function setPvpMsg(t) { const el = document.getElementById('pvpMsg'); if (el) el.textContent = t; }

function joinPvp() {
  Sound.init();
  if (!Net.available()) {
    setPvpMsg('Online duels need a server: run "npm start" in the game folder (npx serve + the duel relay), then open http://localhost:3000.');
    return;
  }
  const name = (document.getElementById('pvpName').value || '').trim().slice(0, 16) || 'Ronin';
  const room = pvpRoom();
  try { localStorage.setItem('rr-name', name); localStorage.setItem('rr-room', room === 'public' ? '' : room); } catch (e) { /* ignore */ }
  setPvpMsg('Connecting…');
  Net.connect(name, room, (w) => { setPvpMsg(''); startPvp(w.map); }, (err) => setPvpMsg(err));
}
function pvpRoom() {
  const raw = (document.getElementById('pvpRoom').value || new URLSearchParams(location.search).get('room') || 'public');
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'public';
}

function updateMouseWorld() {
  if (G.inputBlocked) return;
  G.mouse.x = G.cam.x - G.viewW / 2 + Input.mx / G.scale;
  G.mouse.y = G.cam.y - G.viewH / 2 + Input.my / G.scale;
}

// ------------------------------------------------------------------ simulation
function step(dt) {
  G.time += dt; G.stageTime += dt;
  G.wind = G.windNext; G.windNext = 0;
  updateMouseWorld();
  const p = G.player, L = G.level;
  p.update(dt);
  for (const e of G.enemies) if (e.isBoss || e.isClone || Math.abs(e.x - p.x) < 1500) e.update(dt);
  G.enemies = G.enemies.filter((e) => !e.remove);
  for (const pr of G.projectiles) pr.update(dt);
  G.projectiles = G.projectiles.filter((pr) => !pr.dead);
  if (G.projectiles.length > 260) G.projectiles.splice(0, G.projectiles.length - 260);
  for (const c of G.corpses) c.update(dt);
  G.corpses = G.corpses.filter((c) => !c.gone);
  FX.update(dt);

  if (G.mode === 'pvp') {
    if (p.dead && p.deadT > 2.6) respawnPvp();
    updateCamera(dt);
    return;
  }

  // solid boss bodies push the player out
  if (!p.rag && !p.dead) {
    for (const e of G.enemies) {
      if (!e.solidBody || e.dead) continue;
      const hb = e.hurtboxes()[0], pb = p.hurtbox();
      if (rectsOverlap(hb, pb)) {
        const dir = p.x < e.x ? -1 : 1;
        const target = dir < 0 ? hb.x - pb.w / 2 - 1 : hb.x + hb.w + pb.w / 2 + 1;
        const nx = lerp(p.x, target, 0.35);
        if (!L.boxSolid(nx, p.y, p.w, p.h)) { p.x = nx; p.placeSword(); }
      }
    }
  }

  // shrines
  for (const s of L.shrines) {
    if (!s.used && !p.dead && Math.abs(p.x - s.x) < 50 && Math.abs(p.y - (s.y - 27)) < 60) {
      s.used = true; p.hp = p.maxHp; Sound.heal();
      FX.text(s.x, s.y - 80, 'Restored', '#ffe8a8', 20, { life: 1.6, vy: -30 });
      FX.ring(s.x, s.y - 30, 6, 90, '#ffe8a8', 0.6, 3);
    }
  }

  // boss arena
  const A = L.arena;
  if (A && !A.started && !p.dead && !p.rag && p.x > (A.c0 + 3) * T) {
    A.started = true;
    for (let r = 0; r < A.top; r++) L.set(A.c0, r, 1);
    for (const [c, r, v] of A.gateSpikes) L.set(c, r, v);
    p.placeSword(); // the gate may have slammed shut on the blade
    Sound.gate(); G.shake(10);
    FX.dust(A.c0 * T + T / 2, A.top * T, 14);
    G.enemies = G.enemies.filter((e) => e.x < A.c0 * T);
    G.boss = makeBoss(A.boss, (A.c0 + Math.floor((A.c1 - A.c0) * 0.72)) * T, A.top * T);
    G.enemies.push(G.boss);
    G.bossIntro = 2.6;
    Music.play(A.boss);
  }
  if (G.bossIntro > 0) G.bossIntro -= dt;
  if (G.bossDeadT >= 0) {
    G.bossDeadT += dt;
    if (G.bossDeadT > 3.2 && G.state === 'play' && !p.dead) stageCleared();
  }
  updateCamera(dt);
}

function updateCamera(dt) {
  const p = G.player, L = G.level, cam = G.cam;
  const px = p.rag ? p.rag.p.hip.x : p.x, py = p.rag ? p.rag.p.hip.y : p.y;
  let tx = px + (G.mouse.x - px) * 0.12, ty = py - 40;
  let x0 = G.viewW / 2, x1 = L.width - G.viewW / 2;
  const A = L.arena;
  if (A && A.started) {
    const ax0 = A.c0 * T, ax1 = A.c1 * T;
    if (ax1 - ax0 <= G.viewW) { x0 = x1 = (ax0 + ax1) / 2; } else { x0 = ax0 + G.viewW / 2; x1 = ax1 - G.viewW / 2; }
  }
  if (x1 < x0) x0 = x1 = L.width / 2;
  tx = clamp(tx, x0, x1);
  ty = clamp(ty, G.viewH / 2 - 500, L.height - G.viewH / 2);
  cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.shake = Math.max(0, cam.shake - dt * 30);
  cam.sx = (Math.random() * 2 - 1) * cam.shake; cam.sy = (Math.random() * 2 - 1) * cam.shake;
}

// ------------------------------------------------------------------ screens
const screens = {};
for (const id of ['title', 'help', 'music', 'pause', 'dead', 'clear', 'win']) screens[id] = document.getElementById(id);
function showScreen(id) {
  for (const k in screens) screens[k].classList.toggle('hidden', k !== id);
  document.body.classList.toggle('in-game', id === null);
}

function buildTitle() {
  const wrap = document.getElementById('stages');
  wrap.innerHTML = '';
  STAGES.forEach((s, i) => {
    const btn = document.createElement('button');
    const locked = i >= Save.data.unlocked;
    btn.className = 'stage' + (locked ? ' locked' : '') + (Save.data.cleared[i] ? ' cleared' : '');
    btn.disabled = locked;
    btn.innerHTML = `<span class="num">${['一', '二', '三', '四', '五'][i]}</span><span class="nm">${locked ? '???' : s.name}</span><span class="kj">${locked ? '' : s.kanji}</span><span class="dc">${Save.data.deaths[i] ? '死 ×' + Save.data.deaths[i] : ''}</span>`;
    btn.addEventListener('click', () => { Sound.init(); Sound.click(); startStage(i); });
    wrap.appendChild(btn);
  });
  document.getElementById('muteBtn').textContent = Sound.muted ? 'Sound: off (M)' : 'Sound: on (M)';
  document.getElementById('goreBtn').textContent = Settings.gore ? 'Gore: on' : 'Gore: off';
  const nameEl = document.getElementById('pvpName');
  if (!nameEl.value) { try { nameEl.value = localStorage.getItem('rr-name') || ''; } catch (e) { /* ignore */ } }
  const roomEl = document.getElementById('pvpRoom');
  if (!roomEl.value) { try { roomEl.value = new URLSearchParams(location.search).get('room') || localStorage.getItem('rr-room') || ''; } catch (e) { /* ignore */ } }
  const hint = document.getElementById('pvpHint');
  if (!Net.available()) {
    hint.textContent = 'Run "npm start" to host duels locally, or play the online version.';
  } else if (Net.isOnline()) {
    hint.textContent = 'Online: anyone with the link can join. Leave the room blank for the public duel, or share a room code.';
    fetch(`${Net.relayHttp()}/status?room=${encodeURIComponent(pvpRoom())}`).then((r) => r.json()).then((d) => {
      hint.textContent = `Online · ${d.players ? `${d.players} samurai in "${d.room}" right now` : `"${d.room}" is empty: invite a friend`} · share a room code for a private duel.`;
    }).catch(() => { hint.textContent = 'The online duel server is not reachable right now.'; });
  } else {
    hint.textContent = 'Duel anyone on your network.';
    fetch(`${Net.relayHttp()}/lan`).then((r) => r.json()).then((d) => {
      const port = location.port ? ':' + location.port : '';
      if (d.addresses && d.addresses.length) hint.textContent = `Friends on your network join at  http://${d.addresses[0]}${port}` + (d.players ? `  ·  ${d.players} in duels now` : '');
    }).catch(() => { hint.textContent = 'Duel relay not running: start it with "npm start" (or "node server.js").'; });
  }
}

// ---- koto music room ----
let renderingTrack = null;
function buildMusicRoom() {
  const list = document.getElementById('trackList');
  list.innerHTML = '';
  for (const tr of Music.list()) {
    const row = document.createElement('div');
    row.className = 'track' + (Music.current === tr.id ? ' playing' : '');
    const playing = Music.current === tr.id;
    row.innerHTML = `<div class="tinfo"><span class="tname">${tr.name}</span><span class="tmeta">${tr.mood} · ${tr.bpm} bpm · ${tr.scale} scale</span></div>
      <button class="small ${playing ? '' : 'ghost'}" data-act="trackPlay" data-track="${tr.id}">${playing ? '♪ playing' : '▶ play'}</button>
      <button class="small ghost" data-act="trackSave" data-track="${tr.id}" ${renderingTrack ? 'disabled' : ''}>${renderingTrack === tr.id ? 'rendering…' : '⬇ .wav'}</button>`;
    list.appendChild(row);
  }
}
async function saveTrack(id) {
  if (renderingTrack) return;
  renderingTrack = id; buildMusicRoom();
  try {
    const blob = await Music.renderWav(id, 90);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ragdoll-ronin-${id}.wav`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (e) {
    alert('Could not render the track: ' + e.message);
  }
  renderingTrack = null; buildMusicRoom();
}

function showDeath() {
  G.state = 'dead';
  Save.data.deaths[G.stage]++; Save.save();
  const A = G.level.arena;
  const key = A && A.started ? STAGES[G.stage].boss : 'stage';
  document.getElementById('taunt').textContent = pick(TAUNTS[key]);
  const n = Save.data.deaths[G.stage];
  let extra = '';
  if (n >= 25) extra = ' — legends speak of your persistence (and your keyboard).';
  else if (n >= 10) extra = ' — this is fine. Everything is fine.';
  else if (n >= 5) extra = ' — have you considered not dying?';
  document.getElementById('deathCause').textContent = G.lastHitBy ? `Slain by ${G.lastHitBy}.` : '';
  document.getElementById('deathCount').textContent = `Deaths on this stage: ${n}${extra}`;
  G.uiT = 0;
  Input.pressed.Mouse0 = false;
  showScreen('dead');
}

function stageCleared() {
  G.state = 'clear';
  Save.data.cleared[G.stage] = true;
  Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(STAGES.length, G.stage + 2));
  Save.save();
  if (G.stage === STAGES.length - 1) {
    const total = Save.data.deaths.reduce((a, b) => a + b, 0);
    document.getElementById('winStats').textContent = `Total deaths across your journey: ${total}. The blood moon sets. You may rest, ronin.`;
    showScreen('win');
    return;
  }
  const t = G.stageTime, m = Math.floor(t / 60), s = Math.floor(t % 60);
  document.getElementById('clearStats').innerHTML =
    `<b>${STAGES[G.stage].name}</b> cleared in ${m}:${String(s).padStart(2, '0')}<br>Foes cut down: ${G.kills} · Deaths here: ${Save.data.deaths[G.stage]}`;
  showScreen('clear');
}

function setPauseButtons() {
  const pvp = G.mode === 'pvp';
  document.getElementById('btnRestart').style.display = pvp ? 'none' : '';
  document.getElementById('btnQuit').textContent = pvp ? 'Leave duel' : 'Quit to title';
  document.getElementById('pauseTitle').textContent = pvp ? 'MENU' : 'PAUSED';
}
function pauseGame() {
  if (G.state !== 'play' || G.menuOpen) return;
  setPauseButtons();
  Sound.whoosh(0);
  if (G.mode === 'pvp') { G.menuOpen = true; G.inputBlocked = true; showScreen('pause'); return; } // the duel keeps running
  G.state = 'paused'; showScreen('pause');
}
function resumeGame() {
  if (G.mode === 'pvp') { if (!G.menuOpen) return; G.menuOpen = false; G.inputBlocked = false; Input.clear(); showScreen(null); return; }
  if (G.state !== 'paused') return;
  G.state = 'play'; Input.clear(); showScreen(null);
}
function quitToTitle() {
  Net.disconnect();
  G.menuOpen = false; G.inputBlocked = false;
  Sound.whoosh(0);
  previewStage(Math.max(0, Save.data.unlocked - 1));
  buildTitle(); showScreen('title');
  Music.play('title');
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  Sound.init(); Sound.click();
  switch (a.dataset.act) {
    case 'resume': resumeGame(); break;
    case 'restart': startStage(G.stage); break;
    case 'quit': quitToTitle(); break;
    case 'next': startStage(Math.min(STAGES.length - 1, G.stage + 1)); break;
    case 'mute': Sound.toggleMute(); buildTitle(); break;
    case 'gore':
      Settings.gore = !Settings.gore;
      try { localStorage.setItem('rr-gore', Settings.gore ? '1' : '0'); } catch (err) { /* ignore */ }
      buildTitle(); break;
    case 'retry': if (G.uiT > 0.5) startStage(G.stage); break;
    case 'pvp': joinPvp(); break;
    case 'help': showScreen('help'); break;
    case 'musicRoom': buildMusicRoom(); showScreen('music'); break;
    case 'back': buildTitle(); showScreen('title'); if (Music.current !== 'title') Music.play('title'); break;
    case 'trackPlay': Music.play(a.dataset.track); buildMusicRoom(); break;
    case 'trackSave': saveTrack(a.dataset.track); break;
  }
});
for (const id of ['pvpName', 'pvpRoom']) document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); joinPvp(); } });
window.addEventListener('blur', () => { if (G.mode !== 'pvp') pauseGame(); });

function handleUiKeys() {
  if (Input.take('KeyM')) { Sound.init(); Sound.toggleMute(); if (G.state === 'title') buildTitle(); }
  if (G.mode === 'pvp' && G.state === 'play') {
    if (Input.take('Escape', 'KeyP')) { if (G.menuOpen) resumeGame(); else pauseGame(); }
    if (!G.menuOpen && Input.take('KeyT')) Net.taunt();
    Input.take('KeyR');
    return;
  }
  if (G.state === 'play') {
    if (Input.take('Escape', 'KeyP')) pauseGame();
    else if (Input.take('KeyR')) startStage(G.stage);
  } else if (G.state === 'paused') {
    if (Input.take('Escape', 'KeyP')) resumeGame();
    else if (Input.take('KeyR')) startStage(G.stage);
  } else if (G.state === 'dead') {
    if (G.uiT > 0.5 && Input.take('KeyR', 'Space', 'Enter')) startStage(G.stage);
  } else if (G.state === 'clear') {
    if (Input.take('Enter', 'Space')) startStage(Math.min(STAGES.length - 1, G.stage + 1));
  }
}

// ------------------------------------------------------------------ rendering
function render(rdt) {
  const c = ctx;
  c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  if (!G.level) { c.fillStyle = '#06242b'; c.fillRect(0, 0, G.W, G.H); return; }
  const s = G.scale, L = G.level, pal = L.pal, cam = G.cam;
  const vw = G.viewW, vh = G.viewH;
  G.edgeTint = null;
  // zoom punch (parries) scales the whole scene around the screen centre
  const z = 1 + G.zoomKick;
  c.setTransform(G.dpr * s * z, 0, 0, G.dpr * s * z, G.dpr * s * (1 - z) * vw / 2, G.dpr * s * (1 - z) * vh / 2);
  if (!skyGrad) {
    skyGrad = c.createLinearGradient(0, 0, 0, vh);
    skyGrad.addColorStop(0, pal.skyTop); skyGrad.addColorStop(1, pal.skyBot);
  }
  c.fillStyle = skyGrad; c.fillRect(0, 0, vw, vh);
  const vy = (360 - cam.y);
  const mx = vw * 0.66 - cam.x * 0.02, my = 150 + vy * 0.05;
  const mg = c.createRadialGradient(mx, my, 20, mx, my, 280);
  mg.addColorStop(0, `rgba(${pal.glow},0.55)`); mg.addColorStop(1, `rgba(${pal.glow},0)`);
  c.fillStyle = mg; c.fillRect(mx - 280, my - 280, 560, 560);
  c.fillStyle = pal.moon; c.beginPath(); c.arc(mx, my, 62, 0, TAU); c.fill();
  for (const lay of G.bg) {
    const off = -((cam.x * lay.factor) % BGW + BGW) % BGW;
    const ly = vy * lay.factor * 0.6 + (vh - BGH) * 0.5 + 40 * lay.factor;
    for (let x = off; x < vw; x += BGW) c.drawImage(lay.c, x, ly);
  }
  // world
  c.save();
  c.translate(Math.round(-cam.x + vw / 2 + cam.sx), Math.round(-cam.y + vh / 2 + cam.sy));
  const x0 = cam.x - vw / 2 - 80, x1 = cam.x + vw / 2 + 80;
  for (const l of L.lanterns) if (l.x > x0 && l.x < x1) drawLantern(c, l, pal, G.time);
  for (const sh of L.shrines) if (sh.x > x0 - 100 && sh.x < x1 + 100) drawShrine(c, sh, pal, G.time);
  for (const sg of L.signs) if (sg.x > x0 && sg.x < x1) drawSign(c, sg);
  L.draw(c, x0, x1);
  FX.drawDecals(c);
  FX.drawProps(c);
  for (const co of G.corpses) co.draw(c);
  for (const pr of G.projectiles) if (pr.type === 'marker' || pr.type === 'tornado') pr.draw(c);
  for (const e of G.enemies) if (e.x > x0 - 300 && e.x < x1 + 300) e.draw(c);
  if (G.mode === 'pvp') for (const r of Net.remotes.values()) r.draw(c);
  const preview = G.state === 'title';
  if (!preview) G.player.draw(c);
  for (const pr of G.projectiles) if (pr.type !== 'marker' && pr.type !== 'tornado') pr.draw(c);
  FX.draw(c);
  const p = G.player;
  if (p.planted && !preview) {
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(p.planted.x, p.planted.y, 7 + Math.sin(G.time * 12) * 2, 0, TAU); c.stroke();
  }
  let near = null, nd = 160;
  for (const sg of L.signs) { const d = Math.abs(sg.x - p.x); if (d < nd && Math.abs(sg.y - p.y) < 160) { nd = d; near = sg; } }
  if (near && !preview) drawSignBubble(c, near);
  FX.drawTexts(c);
  c.restore();
  drawMotes(c, rdt, pal);
  c.setTransform(G.dpr * s, 0, 0, G.dpr * s, 0, 0);
  if (!vignette) {
    vignette = c.createRadialGradient(vw / 2, vh / 2, vh * 0.35, vw / 2, vh / 2, vh * 1.0);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  }
  c.fillStyle = vignette; c.fillRect(0, 0, vw, vh);
  if (G.edgeTint) {
    const eg = c.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vh * 0.95);
    eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, G.edgeTint);
    c.fillStyle = eg; c.fillRect(0, 0, vw, vh);
  }
  if (G.slowT > 0) { c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(0, 0, vw, vh); }
  if (!preview) FX.drawScreen(c, vw, vh, rdt);
  if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash})`; c.fillRect(0, 0, vw, vh); }
  G.flash = Math.max(0, G.flash - rdt * 1.8);
  G.zoomKick *= Math.exp(-rdt * 11);
  if (G.zoomKick < 0.001) G.zoomKick = 0;
  if (preview) return;
  drawHUD(c, vw, vh);
  if (G.mode === 'pvp') drawPvpHUD(c, vw, vh, rdt);
  if (G.state === 'play' && !G.menuOpen) drawCursor(c);
}

function drawSignBubble(c, sg) {
  c.font = '600 15px "Zen Kaku Gothic New", system-ui, sans-serif';
  const words = sg.text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > 330 && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  const w = 360, h = lines.length * 21 + 18, x = sg.x - w / 2, y = sg.y - 70 - h;
  c.fillStyle = 'rgba(10,14,18,0.82)';
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#f4ecd8'; c.textAlign = 'center'; c.textBaseline = 'top';
  lines.forEach((l, i) => c.fillText(l, sg.x, y + 10 + i * 21));
}

function drawMotes(c, rdt, pal) {
  const kind = pal.pkind, cam = G.cam;
  c.fillStyle = pal.particle;
  for (const m of G.motes) {
    m.ph += rdt;
    let vx = 0, vy = 0;
    switch (kind) {
      case 'ember': vx = Math.sin(m.ph) * 15; vy = -40 * m.z; break;
      case 'snow': vx = -20 * m.z + (G.wind || 0) * 0.3; vy = 50 * m.z; break;
      case 'petal': vx = -35 * m.z + Math.sin(m.ph * 2) * 20; vy = 30 * m.z; break;
      case 'ash': vx = -15 * m.z; vy = 20 * m.z; break;
      default: vx = Math.sin(m.ph * 0.7) * 10; vy = -8 * m.z;
    }
    m.x += vx * rdt; m.y += vy * rdt;
    const W = G.viewW + 100, H = G.viewH + 100;
    const sx = (((m.x - cam.x * m.z * 0.6) % W) + W) % W - 50;
    const sy = (((m.y - cam.y * m.z * 0.3) % H) + H) % H - 50;
    c.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(m.ph * 1.3)) * m.z;
    if (kind === 'petal') { c.beginPath(); c.ellipse(sx, sy, 3.5 * m.z, 2 * m.z, m.ph, 0, TAU); c.fill(); }
    else { c.beginPath(); c.arc(sx, sy, (kind === 'snow' ? 2.2 : 1.6) * m.z, 0, TAU); c.fill(); }
  }
  c.globalAlpha = 1;
}

const FONT = '"Zen Kaku Gothic New", system-ui, sans-serif', SERIF = '"Shippori Mincho B1", serif';

function drawHUD(c, vw, vh) {
  const p = G.player;
  for (let i = 0; i < p.maxHp; i++) {
    const x = 30 + i * 32, y = 32, full = i < p.hp;
    c.save(); c.translate(x, y);
    c.fillStyle = full ? '#e5323d' : 'rgba(255,255,255,0.12)';
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5 - Math.PI / 2;
      c.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 4, a, 0, TAU);
    }
    c.fill();
    c.fillStyle = full ? '#ffd76a' : 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill();
    c.restore();
  }
  // ki (swing stamina) and dash
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(18, 52, 150, 7);
  c.fillStyle = p.winded ? (Math.floor(G.time * 8) % 2 ? '#ff6a6a' : '#7a2a2a') : '#9fe8ff';
  c.fillRect(18, 52, 150 * (p.ki / 100), 7);
  const dk = 1 - clamp(p.dashCD / 0.48, 0, 1);
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(18, 62, 150, 3);
  c.fillStyle = dk >= 1 ? '#ffffff' : '#5a8a96'; c.fillRect(18, 62, 150 * dk, 3);
  c.font = `700 11px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillStyle = 'rgba(255,255,255,0.65)';
  c.fillText(`${p.winded ? 'WINDED' : 'KI'}   DASH${p.airDash > 0 || p.grounded ? '' : ' ✕'}   JUMP ${p.djump > 0 || p.grounded ? '●' : '○'}   VAULT ${'●'.repeat(p.vaults)}${'○'.repeat(3 - p.vaults)}   KICK ${p.kickCD <= 0 ? '●' : '○'}`, 18, 70);
  const z = p.iai, ch = z && z.phase === 'charge';
  if (ch) {
    c.fillStyle = z.charge >= 1 ? '#ffd76a' : '#ffffff'; c.font = `900 13px ${FONT}`;
    c.fillText(`IAI  ${'█'.repeat(Math.ceil(z.charge * 10))}${z.charge >= 1 ? '  RELEASE!' : ''}`, 18, 84);
  }
  if (p.riposte > 0) {
    c.fillStyle = '#ffd76a'; c.font = `900 13px ${FONT}`;
    c.fillText(`RIPOSTE  ${'█'.repeat(Math.ceil(p.riposte * 10))}`, 18, ch ? 98 : 84);
  }
  if (G.mode === 'pvp') return;
  const def = STAGES[G.stage];
  c.textAlign = 'right';
  c.font = `800 20px ${SERIF}`; c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fillText(def.kanji, vw - 20, 18);
  c.font = `600 12px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText(`${def.name.toUpperCase()}  ·  死 ${Save.data.deaths[G.stage]}`, vw - 20, 44);
  const b = G.boss;
  if (b && (!b.dead || G.bossDeadT < 2)) {
    const w = Math.min(640, vw - 80), x = (vw - w) / 2, y = vh - 54;
    const k = clamp(b.hp / b.maxHp, 0, 1);
    b.shownHp = b.shownHp === undefined ? k : lerp(b.shownHp, k, 0.08);
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 3, y - 3, w + 6, 16);
    c.fillStyle = '#ffffff'; c.fillRect(x, y, w * b.shownHp, 10);
    c.fillStyle = b.p2 ? '#ff3b3b' : '#c92a35'; c.fillRect(x, y, w * k, 10);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x + w / 2 - 1, y - 3, 2, 16);
    c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.font = `800 20px ${SERIF}`; c.fillStyle = '#fff';
    c.fillText(`${b.kanji}  ${b.name}`, x, y - 8);
    const nw = c.measureText(`${b.kanji}  ${b.name}`).width;
    c.font = `600 13px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillText(b.title, x + nw + 12, y - 10);
  }
  if (G.bossIntro > 0 && b) {
    const t = 2.6 - G.bossIntro;
    const a = t < 0.4 ? t / 0.4 : G.bossIntro < 0.6 ? G.bossIntro / 0.6 : 1;
    c.globalAlpha = a;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, vh * 0.32, vw, 150);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 72px ${SERIF}`; c.fillStyle = '#fff';
    c.fillText(b.kanji, vw / 2, vh * 0.32 + 58);
    c.font = `800 22px ${FONT}`; c.fillStyle = '#ffd7d7';
    c.fillText(`${b.name} — ${b.title}`, vw / 2, vh * 0.32 + 120);
    c.globalAlpha = 1;
  }
}

function drawPvpHUD(c, vw, vh, rdt) {
  const list = [...Net.roster.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  let y = 16;
  c.textBaseline = 'top'; c.textAlign = 'right';
  c.font = `800 12px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.65)';
  const pingCol = Net.ping < 80 ? '#7dffa0' : Net.ping < 160 ? '#ffe14a' : '#ff7a7a';
  c.fillText(`${Net.isOnline() ? 'ONLINE' : 'LAN'} DUEL · ${Net.room.toUpperCase()} · FIRST TO ${Net.target}`, vw - 20, y);
  c.fillStyle = pingCol; c.fillText(`${Net.ping} ms`, vw - 20, y + 15); y += 34;
  for (const r of list) {
    const me = r.id === Net.id;
    c.fillStyle = me ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.35)'; c.fillRect(vw - 232, y - 2, 214, 20);
    c.fillStyle = r.color; c.fillRect(vw - 228, y + 3, 8, 10);
    c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.font = `${me ? 800 : 600} 13px ${FONT}`;
    c.fillText(r.name, vw - 214, y + 1);
    c.textAlign = 'right'; c.fillText(`${r.kills}  /  ${r.deaths}`, vw - 24, y + 1);
    y += 22;
  }
  y += 8;
  c.font = `700 13px ${FONT}`; c.textAlign = 'right';
  for (const f of Net.feed) { c.globalAlpha = Math.min(1, f.t); c.fillStyle = f.col; c.fillText(f.text, vw - 20, y); y += 18; }
  c.globalAlpha = 1;
  c.textAlign = 'left'; c.font = `600 11px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.45)';
  c.fillText('T  taunt     Esc  menu', 18, p0hint());
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (G.mapCard > 0) {
    G.mapCard -= rdt;
    const def = PVP_MAPS[G.pvpMap];
    c.globalAlpha = clamp(G.mapCard, 0, 1);
    c.font = `800 40px ${SERIF}`; c.fillStyle = '#fff'; c.fillText(def.kanji, vw / 2, 70);
    c.font = `800 14px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillText(def.name.toUpperCase(), vw / 2, 104);
    c.globalAlpha = 1;
  }
  const p = G.player;
  if (p.dead) {
    c.fillStyle = 'rgba(40,0,6,0.45)'; c.fillRect(0, vh * 0.38, vw, 110);
    c.font = `800 34px ${SERIF}`; c.fillStyle = '#ff6a6a';
    c.fillText(G.killedBy ? `SLAIN BY ${G.killedBy.toUpperCase()}` : 'DEFEATED', vw / 2, vh * 0.38 + 40);
    c.font = `700 15px ${FONT}`; c.fillStyle = '#ffffff';
    c.fillText(`Respawning in ${Math.max(1, Math.ceil(2.6 - p.deadT))}…`, vw / 2, vh * 0.38 + 80);
  }
  if (Net.over) {
    Net.over.t -= rdt;
    const w = Net.roster.get(Net.over.winner);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, vh * 0.2, vw, 130);
    c.font = `800 46px ${SERIF}`; c.fillStyle = w ? w.color : '#ffffff';
    c.fillText(w ? `${w.name.toUpperCase()} WINS THE DUEL` : 'DUEL OVER', vw / 2, vh * 0.2 + 52);
    c.font = `700 15px ${FONT}`; c.fillStyle = '#ffffff';
    c.fillText(`Next duel in ${Math.max(1, Math.ceil(Net.over.t))}…`, vw / 2, vh * 0.2 + 100);
  }
}

function p0hint() { const p = G.player; return 88 + (p.iai && p.iai.phase === 'charge' ? 14 : 0) + (p.riposte > 0 ? 14 : 0); }

function drawCursor(c) {
  const x = Input.mx / G.scale, y = Input.my / G.scale;
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke();
  c.fillStyle = Input.mr ? '#ffd76a' : '#fff';
  c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill();
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), acc = 0, frameErrors = 0;
function frame(now) {
  requestAnimationFrame(frame); // schedule first so one bad frame can never freeze the game
  try { tickFrame(now); } catch (e) { if (frameErrors++ < 5) console.error(e); }
}
function tickFrame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.uiT += rdt;
  handleUiKeys();
  if (G.state === 'play' || G.state === 'dead' || G.state === 'clear') {
    if (G.slowT > 0) { G.slowT -= rdt; G.timeScale = G.slowT > 0 ? G.slowScale : 1; } else G.timeScale = 1;
    acc += rdt * G.timeScale;
    let n = 0;
    while (acc >= STEP && n < 10) {
      acc -= STEP; n++;
      if (G.hitstop > 0) { G.hitstop -= STEP; continue; }
      step(STEP);
    }
    if (n >= 10) acc = 0;
    if (G.mode === 'story' && G.state === 'play' && G.player.dead && G.player.deadT > 1.5) showDeath();
  }
  if (G.mode === 'pvp' && Net.connected) { Net.update(rdt); Net.tick(now, G.player); }
  if (G.state === 'dead' && Input.take('Mouse0') && G.uiT > 0.5) startStage(G.stage);
  if (G.state === 'title' && G.level) {
    G.time += rdt;
    G.cam.x += rdt * 28;
    if (G.cam.x > G.level.width - G.viewW / 2 - 1400) G.cam.x = G.viewW / 2 + 200;
  }
  render(rdt);
}

// ------------------------------------------------------------------ boot
Save.load();
Input.init();
resize();
window.addEventListener('resize', resize);
buildTitle();
showScreen('title');
previewStage(Math.max(0, Save.data.unlocked - 1));
// audio can only start after a user gesture
const firstGesture = () => {
  Sound.init();
  if (G.state === 'title' && !Music.current) Music.play('title');
  removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture);
};
addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);
// dev shortcuts: ?stage=3   ?stage=3&boss   ?stage=1&boss&force=counter   ?duel=Name (needs server.js)
(function devParams() {
  const q = new URLSearchParams(location.search);
  if (q.has('force')) G.devForce = q.get('force');
  if (q.has('duel')) { document.getElementById('pvpName').value = q.get('duel'); joinPvp(); return; }
  if (!q.has('stage')) return;
  const i = clamp(parseInt(q.get('stage'), 10) - 1 || 0, 0, STAGES.length - 1);
  startStage(i);
  if (q.has('boss') && G.level.arena) {
    const A = G.level.arena, p = G.player;
    p.x = (A.c0 + 5) * T; p.y = A.top * T - 30;
    p.placeSword(); p.buildPose();
    p.band1.reset(p.pose.head.x, p.pose.head.y); p.band2.reset(p.pose.head.x, p.pose.head.y);
    G.cam.x = p.x;
  }
  const ff = parseFloat(q.get('ff')); // fast-forward the simulation (screenshots / testing)
  if (ff > 0) for (let i = 0; i < ff / STEP; i++) step(STEP);
  if (q.get('fx') === 'parry') { const p = G.player; FX.parryBurst(p.sword.tx, p.sword.ty, 1); FX.text(p.sword.tx, p.sword.ty - 26, 'PARRY!', '#fff6a0', 24); }
})();
requestAnimationFrame(frame);
