'use strict';
// Synthesized sound effects (WebAudio, no asset files). The koto soundtrack lives in music.js.
const Sound = (() => {
  let ac = null, master = null, sfx = null, mus = null, rev = null, nbuf = null, wh = null;
  let muted = false;
  try { muted = localStorage.getItem('rr-muted') === '1'; } catch (e) { /* storage blocked */ }
  const last = Object.create(null);

  // Stereo impulse response: noise with an exponential decay that darkens over time.
  function makeIR(ctx, seconds = 2.6, decay = 2.8) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.85 - 0.8 * t);
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return ir;
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(comp);
    mus = ac.createGain(); mus.gain.value = 0.55; mus.connect(comp);
    rev = ac.createConvolver(); rev.buffer = makeIR(ac, 2.4, 3);
    const revOut = ac.createGain(); revOut.gain.value = 0.55;
    rev.connect(revOut); revOut.connect(comp);
    nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // continuous sword whoosh driven by blade speed
    const src = ac.createBufferSource(); src.buffer = nbuf; src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(sfx); src.start();
    wh = { bp, g };
  }
  const ok = (k, ms) => {
    const n = performance.now();
    if (last[k] && n - last[k] < ms) return false;
    last[k] = n; return true;
  };
  function env(g, t, a, v, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
  }
  function send(g, amt) { if (amt) { const s = ac.createGain(); s.gain.value = amt; g.connect(s); s.connect(rev); } }
  function tone(f, dur, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || dur));
    const g = ac.createGain(); env(g, t, o.a || 0.004, o.vol || 0.2, dur);
    let n = osc;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; n.connect(fl); n = fl; }
    n.connect(g); g.connect(sfx); send(g, o.rev);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = nbuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = o.ft || 'bandpass';
    fl.frequency.setValueAtTime(o.f || 1000, t); fl.Q.value = o.q || 1;
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ac.createGain(); env(g, t, o.a || 0.004, o.vol || 0.2, dur);
    src.connect(fl); fl.connect(g); g.connect(sfx); send(g, o.rev);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  return {
    init, makeIR,
    get ctx() { return ac; },
    get musBus() { return mus; },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.8;
      try { localStorage.setItem('rr-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      return muted;
    },
    whoosh(speed) {
      if (!wh) return;
      const v = clamp((speed - 500) / 2600, 0, 1);
      wh.g.gain.setTargetAtTime(v * 0.26, ac.currentTime, 0.03);
      wh.bp.frequency.setTargetAtTime(500 + Math.min(speed, 4000) * 0.6, ac.currentTime, 0.03);
    },
    clang(v = 1) {
      if (!ok('clang', 60)) return;
      const b = rand(1300, 1700);
      [1, 2.32, 4.25, 6.63].forEach((r, i) => tone(b * r, 0.25 + (0.35 * v) / (i + 1), { vol: (0.09 * v) / (i * 0.6 + 1), rev: 0.15 }));
      noise(0.06, { ft: 'highpass', f: 3500, vol: 0.25 * v });
    },
    // the big one: bright transient, shimmering bell partials, a rising "shing", a weighty thump, an airy tail
    parry() {
      if (!ok('parry', 80)) return;
      noise(0.05, { ft: 'highpass', f: 4200, vol: 0.55, rev: 0.3 });
      const b = 1180;
      [1, 2.76, 5.4, 8.93, 13.34].forEach((r, i) => {
        tone(b * r, 1.7 / (i * 0.4 + 1), { vol: 0.13 / (i + 1), rev: 0.7 });
        tone(b * r * 1.007, 1.4 / (i * 0.4 + 1), { vol: 0.07 / (i + 1), rev: 0.7 });
      });
      tone(2200, 0.5, { f2: 4400, slide: 0.22, vol: 0.07, type: 'triangle', rev: 0.6 });
      tone(150, 0.4, { f2: 42, vol: 0.5 });
      noise(0.28, { ft: 'lowpass', f: 700, f2: 90, vol: 0.32 });
      noise(1.1, { f: 6500, f2: 1800, q: 2, vol: 0.07, a: 0.02, rev: 0.9 });
    },
    kick() { if (!ok('kick', 60)) return; tone(130, 0.18, { f2: 55, vol: 0.45 }); noise(0.1, { ft: 'lowpass', f: 900, f2: 200, vol: 0.4 }); },
    riposte() { tone(880, 0.6, { vol: 0.08, rev: 0.6 }); tone(1320, 0.7, { vol: 0.07, delay: 0.06, rev: 0.6 }); tone(1760, 0.9, { vol: 0.06, delay: 0.12, rev: 0.7 }); noise(0.2, { f: 1500, f2: 5000, vol: 0.2 }); },
    throwBlade() { if (!ok('throw', 80)) return; noise(0.28, { f: 900, f2: 3200, q: 2, vol: 0.22 }); tone(600, 0.2, { f2: 1200, vol: 0.04, type: 'triangle' }); },
    catchBlade() { tone(1900, 0.25, { vol: 0.07, rev: 0.3 }); noise(0.05, { ft: 'highpass', f: 3000, vol: 0.2 }); },
    scrape() { if (!ok('scrape', 80)) return; noise(0.13, { f: 2800, f2: 900, q: 2, vol: 0.16 }); tone(1500, 0.07, { vol: 0.025 }); },
    tink() { if (!ok('tink', 40)) return; tone(3200, 0.18, { vol: 0.08, rev: 0.2 }); tone(4700, 0.12, { vol: 0.05 }); noise(0.04, { ft: 'highpass', f: 5000, vol: 0.15 }); },
    slash(d = 1) {
      if (!ok('slash', 30)) return;
      noise(0.12 + d * 0.03, { f: 1800, f2: 300, q: 0.8, vol: 0.3 + d * 0.08 });
      tone(150, 0.16, { f2: 50, vol: 0.25 + d * 0.06 });
      if (d >= 3) tone(90, 0.4, { f2: 40, vol: 0.35, type: 'triangle' });
    },
    hurt() { tone(320, 0.32, { f2: 80, type: 'sawtooth', vol: 0.18, lp: 1400 }); noise(0.25, { ft: 'lowpass', f: 900, vol: 0.3 }); },
    jump() { if (!ok('jump', 40)) return; tone(260, 0.09, { f2: 480, type: 'square', vol: 0.045, lp: 1600 }); },
    djump() { tone(380, 0.12, { f2: 760, type: 'square', vol: 0.045, lp: 2000 }); noise(0.12, { f: 1500, f2: 3500, vol: 0.08 }); },
    dash() { if (!ok('dash', 50)) return; noise(0.2, { f: 500, f2: 2600, q: 1.2, vol: 0.3 }); },
    land() { if (!ok('land', 90)) return; noise(0.07, { ft: 'lowpass', f: 380, vol: 0.2 }); },
    plant() { if (!ok('plant', 80)) return; tone(700, 0.25, { vol: 0.08 }); tone(1650, 0.18, { vol: 0.05 }); noise(0.1, { ft: 'lowpass', f: 1200, vol: 0.3 }); },
    vault() { tone(200, 0.2, { f2: 900, type: 'triangle', vol: 0.12 }); noise(0.15, { f: 800, f2: 3000, vol: 0.12 }); },
    swing() { if (!ok('swing', 50)) return; noise(0.16, { f: 700, f2: 2400, q: 1.5, vol: 0.16 }); },
    shoot() { if (!ok('shoot', 40)) return; tone(700, 0.1, { f2: 160, type: 'triangle', vol: 0.12 }); noise(0.08, { ft: 'highpass', f: 2000, vol: 0.1 }); },
    thunk() { if (!ok('thunk', 50)) return; noise(0.06, { ft: 'lowpass', f: 700, vol: 0.18 }); tone(180, 0.06, { vol: 0.1 }); },
    shing() { if (!ok('shing', 120)) return; tone(3300, 0.55, { vol: 0.05, rev: 0.3 }); tone(4950, 0.4, { vol: 0.03, delay: 0.02 }); },
    // Ronin enters his counter stance: a two-note temple bell call over a low hum
    stance() {
      if (!ok('stance', 300)) return;
      tone(1568, 1.3, { vol: 0.1, rev: 0.7 }); tone(1568 * 2.76, 0.6, { vol: 0.03, rev: 0.7 });
      tone(2093, 1.5, { vol: 0.1, delay: 0.14, rev: 0.7 }); tone(2093 * 2.76, 0.7, { vol: 0.03, delay: 0.14, rev: 0.7 });
      tone(196, 1.4, { vol: 0.12, type: 'triangle', a: 0.25 });
      noise(0.9, { f: 3000, f2: 6500, q: 3, vol: 0.05, a: 0.25, rev: 0.6 });
    },
    counterCut() {
      tone(3300, 0.45, { vol: 0.07, rev: 0.5 });
      noise(0.25, { f: 600, f2: 4200, q: 1.2, vol: 0.38 });
      tone(110, 0.3, { f2: 48, vol: 0.4 });
    },
    boom(v = 1) { tone(95, 0.8 * v, { f2: 30, vol: 0.55 * v }); noise(0.6 * v, { ft: 'lowpass', f: 420, f2: 80, vol: 0.45 * v }); },
    roar() {
      tone(78, 1.4, { f2: 55, type: 'sawtooth', vol: 0.2, lp: 520, a: 0.08 });
      tone(82, 1.3, { f2: 58, type: 'sawtooth', vol: 0.16, lp: 480, a: 0.1 });
      noise(1.2, { ft: 'lowpass', f: 600, vol: 0.25, a: 0.1 });
    },
    caw() { tone(980, 0.22, { f2: 520, type: 'square', vol: 0.06, lp: 2200 }); tone(940, 0.26, { f2: 480, type: 'square', vol: 0.06, lp: 2200, delay: 0.24 }); },
    fox() { if (!ok('fox', 70)) return; tone(520, 0.3, { f2: 1300, vol: 0.06 }); tone(780, 0.3, { f2: 1950, vol: 0.03, type: 'triangle' }); },
    poof() { if (!ok('poof', 60)) return; noise(0.35, { ft: 'lowpass', f: 2400, f2: 200, vol: 0.25 }); },
    wind() { noise(2.2, { f: 280, f2: 700, q: 0.7, vol: 0.35, a: 0.35 }); },
    edeath() { tone(220, 0.45, { f2: 50, type: 'triangle', vol: 0.15 }); },
    pdeath() { [110, 165, 220.5].forEach((f, i) => tone(f, 2.8, { vol: 0.14 / (i + 1), a: 0.01, rev: 0.4 })); noise(0.5, { ft: 'lowpass', f: 300, vol: 0.4 }); },
    heal() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { vol: 0.07, delay: i * 0.07, type: 'triangle', rev: 0.4 })); },
    gate() { tone(70, 0.6, { f2: 40, vol: 0.4 }); noise(0.4, { ft: 'lowpass', f: 300, vol: 0.4 }); },
    gong() { [98, 196.5, 263, 392.7].forEach((f, i) => tone(f, 3.5, { vol: 0.16 / (i + 1), rev: 0.5 })); },
    click() { tone(900, 0.05, { vol: 0.05 }); },
  };
})();
