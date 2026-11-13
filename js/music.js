'use strict';
// Koto soundtrack. Strings are physically modelled (Karplus-Strong plucked string), joined by a shō
// reed-organ pad, a breathy shakuhachi and taiko drums. A seeded composer writes each track from
// motifs -> phrases -> sections (intro, theme A, variations, contrasting B), so every stage and boss
// has its own recognisable piece. Instruments take any BaseAudioContext, so tracks can also be
// rendered offline to .wav from the music room.
const Music = (() => {
  const SCALES = {
    in: [0, 1, 5, 7, 8],      // miyako-bushi: classic, melancholy
    hira: [0, 2, 3, 7, 8],    // hirajoshi: the standard koto tuning
    yo: [0, 2, 5, 7, 9],      // bright folk scale
    kumoi: [0, 2, 3, 7, 9],   // airy, open
    iwato: [0, 1, 5, 6, 10],  // dark, unstable
  };
  const TRACKS = {
    title: { name: 'Moon Over Thirteen Strings', root: 50, scale: 'hira', bpm: 66, mood: 'calm', seed: 101 },
    ruins: { name: 'Moonlit Ruins', root: 50, scale: 'in', bpm: 76, mood: 'calm', seed: 202 },
    ember: { name: 'Ember Pass', root: 52, scale: 'iwato', bpm: 92, mood: 'tense', seed: 303 },
    peaks: { name: 'Crow Peaks', root: 55, scale: 'kumoi', bpm: 84, mood: 'airy', seed: 404 },
    shrine: { name: 'Fox Shrine', root: 57, scale: 'hira', bpm: 100, mood: 'playful', seed: 505 },
    castle: { name: 'Blood Moon Castle', root: 49, scale: 'in', bpm: 72, mood: 'ominous', seed: 606 },
    ronin: { name: 'Duel - The Wandering Blade', root: 50, scale: 'in', bpm: 138, mood: 'boss', seed: 707 },
    oni: { name: 'Duel - Red Oni of the Pass', root: 45, scale: 'iwato', bpm: 124, mood: 'boss', seed: 808, heavy: true },
    tengu: { name: 'Duel - Lord of Crows', root: 55, scale: 'kumoi', bpm: 148, mood: 'boss', seed: 909 },
    kitsune: { name: 'Duel - Nine Tails', root: 57, scale: 'hira', bpm: 142, mood: 'boss', seed: 1001 },
    shogun: { name: 'Duel - The Iron Shogun', root: 49, scale: 'in', bpm: 152, mood: 'boss', seed: 1102, heavy: true },
    duel: { name: 'LAN Duel', root: 52, scale: 'hira', bpm: 140, mood: 'boss', seed: 1203 },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // loudness balance between sparse and dense arrangements (measured from offline renders)
  const MOOD_GAIN = { calm: 2.2, airy: 2.3, playful: 1.6, tense: 1.0, ominous: 1.0, boss: 0.8 };

  // ------------------------------------------------------------------ instruments
  const ksCache = new Map();
  // Karplus-Strong: a noise burst (shaped by pick position) circulating in a delay line with a
  // lowpass averaging filter. Normalised, with a short ivory-pick click on the attack.
  function ksBuffer(ctx, midi) {
    const sr = ctx.sampleRate, key = sr + ':' + midi;
    let e = ksCache.get(key);
    if (e) return e;
    const f = mtof(midi);
    const N = Math.max(4, Math.floor(sr / f - 0.5));
    const dur = clamp(3.3 - (midi - 40) * 0.045, 1.0, 3.4);
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.7; ring[i] = lp; }
    const P = Math.max(1, Math.round(N * 0.13)), tmp = ring.slice();
    let mean = 0;
    for (let i = 0; i < N; i++) { ring[i] = tmp[i] - 0.7 * tmp[(i + N - P) % N]; mean += ring[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) ring[i] -= mean;
    const rho = Math.pow(10, -3 / (dur * 0.75 * f));
    let idx = 0, peak = 1e-6;
    for (let n = 0; n < len; n++) {
      const a = ring[idx], nx = idx + 1 === N ? 0 : idx + 1;
      out[n] = a;
      ring[idx] = rho * 0.5 * (a + ring[nx]);
      idx = nx;
      if (n < N * 3) peak = Math.max(peak, Math.abs(a));
    }
    const g = 0.8 / peak, clickLen = Math.min(len, Math.floor(sr * 0.006));
    for (let n = 0; n < len; n++) out[n] *= g;
    for (let n = 0; n < clickLen; n++) out[n] += (Math.random() * 2 - 1) * 0.22 * (1 - n / clickLen);
    for (let n = Math.max(0, len - 256), k = 0; n < len; n++, k++) out[n] *= 1 - k / 256;
    e = { buf, rate: (f * (N + 0.5)) / sr };
    ksCache.set(key, e);
    return e;
  }

  const noiseCache = new WeakMap();
  function noiseBuf(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ctx, b);
    }
    return b;
  }

  // Per-context room (dry + reverb), then per-track output with a koto body resonance.
  const roomCache = new WeakMap();
  function room(ctx, dest) {
    let r = roomCache.get(ctx);
    if (r) return r;
    const input = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.85;
    const conv = ctx.createConvolver(); conv.buffer = Sound.makeIR(ctx, 3.2, 3);
    const wet = ctx.createGain(); wet.gain.value = 0.34;
    input.connect(dry); dry.connect(dest);
    input.connect(conv); conv.connect(wet); wet.connect(dest);
    r = { input };
    roomCache.set(ctx, r);
    return r;
  }
  function trackOut(ctx, dest) {
    const out = ctx.createGain();
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 900; body.Q.value = 0.9; body.gain.value = 4;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5200; air.gain.value = -6;
    body.connect(air); air.connect(out);
    out.connect(room(ctx, dest).input);
    return { out, koto: body };
  }

  // koto pluck with optional oshide (press-bend), release, yuri (vibrato) and damping
  function koto(ctx, dst, t, midi, vel, o) {
    const { buf, rate } = ksBuffer(ctx, midi);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const pr = src.playbackRate;
    pr.setValueAtTime(rate * 1.006, t); pr.exponentialRampToValueAtTime(rate, t + 0.07);
    if (o.bend) {
      const bt = t + Math.max(0.09, o.bendAt || 0.18), r2 = rate * Math.pow(2, o.bend / 12);
      pr.setValueAtTime(rate, bt); pr.linearRampToValueAtTime(r2, bt + 0.13);
      if (o.rel && t + o.rel > bt + 0.14) { pr.setValueAtTime(r2, t + o.rel); pr.linearRampToValueAtTime(rate, t + o.rel + 0.12); }
    }
    if (o.vib) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(rate * 0.012, t + 0.55);
      lfo.connect(lg); lg.connect(pr); lfo.start(t); lfo.stop(t + buf.duration);
    }
    const g = ctx.createGain(); g.gain.value = vel;
    if (o.damp) g.gain.setTargetAtTime(0, t + o.damp, 0.05);
    const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan || 0, -1, 1);
    src.connect(g); g.connect(p); p.connect(dst);
    src.start(t); src.stop(t + buf.duration);
  }

  // shō: detuned reed cluster with slow swells
  function sho(ctx, dst, t, midis, dur, vol) {
    const g = ctx.createGain(), att = Math.min(1.6, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + dur - att); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.5;
    lp.connect(g); g.connect(dst);
    for (const m of midis) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.16 / midis.length;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  // shakuhachi: triangle tone that scoops up into pitch, delayed vibrato, breath noise
  function flute(ctx, dst, t, midi, dur, vol) {
    const f = mtof(midi);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f * 0.95, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.22);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.014, t + dur * 0.7);
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.16);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.5); g.gain.linearRampToValueAtTime(vol * 0.9, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2600;
    o.connect(lpf); lpf.connect(g); g.connect(dst);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.5, t + 0.08);
    ng.gain.linearRampToValueAtTime(vol * 0.12, t + 0.4); ng.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(ng); ng.connect(dst);
    o.start(t); lfo.start(t); n.start(t, Math.random() * 0.5);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
  }

  function noiseHit(ctx, dst, t, type, f, dur, vol, q = 1) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx);
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(dst);
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }
  function drum(ctx, dst, t, kind, vol) {
    if (kind === 'don' || kind === 'odaiko') {
      const big = kind === 'odaiko';
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(big ? 80 : 110, t); o.frequency.exponentialRampToValueAtTime(big ? 32 : 44, t + (big ? 0.45 : 0.3));
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.0 : 0.6));
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + 1.05);
      noiseHit(ctx, dst, t, 'lowpass', big ? 180 : 260, 0.14, vol * 0.6);
    } else if (kind === 'ka') {
      noiseHit(ctx, dst, t, 'bandpass', 2600, 0.035, vol * 0.8, 3);
      const o = ctx.createOscillator(); o.frequency.value = 1150;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.05);
    } else {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.15);
      noiseHit(ctx, dst, t, 'highpass', 1800, 0.05, vol * 0.3);
    }
  }
  function rin(ctx, dst, t, midi, vol) {
    const f = mtof(midi);
    [1, 2.74, 5.36, 8.8].forEach((r, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol / (i + 1.4), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 / (i + 1));
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + 3.3);
    });
  }
  function wind(ctx, dst, t, dur, vol) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t); bp.frequency.linearRampToValueAtTime(900, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(dst); n.start(t); n.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ composer
  const RHYTHMS = {
    calm: [[4, 4, 8], [8, 4, 4], [6, 2, 8], [4, 2, 2, 8], [12, 4], [2, 2, 4, 8], [6, 2, 4, 4], [8, 8], [4, 4, 4, 4]],
    playful: [[3, 1, 2, 2, 4, 4], [2, 2, 3, 1, 8], [1, 1, 2, 4, 4, 4], [4, 2, 2, 2, 2, 4], [3, 3, 2, 4, 4]],
    boss: [[2, 2, 2, 2, 2, 2, 2, 2], [1, 1, 2, 2, 2, 4, 2, 2], [3, 3, 2, 4, 4], [2, 2, 4, 2, 2, 4], [4, 2, 2, 4, 2, 2], [1, 1, 1, 1, 4, 4, 4], [2, 1, 1, 2, 2, 4, 4]],
  };
  const STEPS = [-2, -1, -1, -1, 0, 1, 1, 1, 2, 3, -3];

  class Composer {
    constructor(tr) {
      this.tr = tr; this.R = mulberry32(tr.seed);
      this.sc = SCALES[tr.scale];
      this.boss = tr.mood === 'boss';
      this.spb = 60 / tr.bpm;
      this.barDur = this.spb * 4;
      this.plan = this.boss ? ['I', 'A', 'A2', 'B', 'A3', 'B2'] : ['I', 'A', 'A2', 'B', 'A3'];
      this.secLen = { I: 2, A: 4, A2: 4, B: 4, A3: 4, B2: 4 };
      this.si = 0; this.sb = 0; this.bar = 0; this.loop = 0;
      this.mA = [this.motif(), this.motif()];
      this.progA = this.pick([[0, 0, 3, 0], [0, 2, 3, 0], [0, 4, 3, 0], [0, 0, 2, 3]]);
      this.newB();
    }
    pick(a) { return a[Math.floor(this.R() * a.length)]; }
    midi(k) { const n = this.sc.length; return this.tr.root + 12 * Math.floor(k / n) + this.sc[((k % n) + n) % n]; }
    newB() {
      this.mB = [this.motif(), this.motif()];
      this.progB = this.pick([[2, 3, 4, 3], [3, 2, 0, 3], [4, 3, 2, 3], [2, 2, 3, 3]]);
    }
    motif() {
      const R = this.R;
      const set = this.boss ? RHYTHMS.boss : this.tr.mood === 'playful' ? RHYTHMS.playful : RHYTHMS.calm;
      const rh = this.pick(set);
      const notes = [];
      let pos = 0, k = 0;
      for (const len of rh) {
        if (!(notes.length && R() < (this.boss ? 0.12 : 0.18))) notes.push({ pos, len, k });
        k = clamp(k + STEPS[Math.floor(R() * STEPS.length)], -4, 5);
        pos += len;
      }
      return notes;
    }
    // events for one bar: { b: beat offset, fn, ... }
    nextBar() {
      const sec = this.plan[this.si], bi = this.sb, ev = [];
      this.compose(sec, bi, ev);
      this.sb++;
      if (this.sb >= this.secLen[sec]) {
        this.sb = 0; this.si++;
        if (this.si >= this.plan.length) { this.si = 1; this.loop++; this.newB(); }
      }
      this.bar++;
      return ev;
    }
    compose(sec, bi, ev) {
      const isB = sec[0] === 'B', intro = sec === 'I';
      const prog = isB ? this.progB : this.progA;
      const chord = prog[bi % 4];
      const last = bi === this.secLen[sec] - 1;
      if (!intro) {
        const motifs = isB ? this.mB : this.mA;
        let center = (isB ? 10 : 7) + (this.boss ? 1 : 0);
        if (sec === 'A3' && !this.boss) center += 3;
        if ((sec === 'A2' || sec === 'B2') && bi % 2) center += 1;
        const m = motifs[bi % 2];
        if (last) this.cadence(m, center, ev);
        else this.melody(m, center + (bi === 2 ? (isB ? -1 : 2) : 0), ev, sec);
      }
      this.accomp(sec, bi, chord, ev, intro, last);
    }
    melody(m, c, ev, sec) {
      const R = this.R;
      for (const n of m) {
        const k = clamp(c + n.k, 4, 14), midi = this.midi(k);
        const vel = (n.pos % 8 === 0 ? 0.5 : n.pos % 4 === 0 ? 0.42 : 0.34) * (0.9 + R() * 0.2);
        const durS = (n.len * this.spb) / 4;
        const o = { pan: (R() - 0.5) * 0.4 };
        if (n.len >= 6 && R() < 0.45) { o.bend = R() < 0.6 ? 1 : 2; o.bendAt = durS * 0.45; if (R() < 0.5) o.rel = durS * 0.85; }
        else if (n.len >= 6 && R() < 0.5) o.vib = true;
        if (this.boss && n.len >= 4 && R() < 0.35) { this.tremolo(k, n.pos, n.len, vel, ev); continue; }
        ev.push({ b: n.pos / 4, fn: 'koto', midi, vel, o });
        if (n.pos % 8 === 0 && R() < (sec === 'A2' || sec === 'A3' ? 0.5 : 0.2)) ev.push({ b: n.pos / 4, fn: 'koto', midi: this.midi(k - 5), vel: vel * 0.6, o: { pan: -0.2 } });
        if (n.len >= 4 && n.pos > 0 && R() < 0.12) ev.push({ b: n.pos / 4 - 0.06, fn: 'koto', midi: this.midi(k - 1), vel: vel * 0.45, o: { damp: 0.05 } });
      }
    }
    cadence(m, c, ev) {
      const R = this.R;
      for (const n of m) if (n.pos < 8) ev.push({ b: n.pos / 4, fn: 'koto', midi: this.midi(clamp(c + n.k, 4, 14)), vel: 0.38, o: { pan: 0.1 } });
      const home = Math.round(c / 5) * 5;
      const o = R() < 0.5 ? { vib: true } : { bend: 2, bendAt: this.spb * 0.6, rel: this.spb * 1.6 };
      ev.push({ b: 2, fn: 'koto', midi: this.midi(home), vel: 0.5, o });
      ev.push({ b: 2, fn: 'koto', midi: this.midi(home - 5), vel: 0.3, o: { pan: -0.2 } });
      if (this.boss || R() < 0.4) this.sararin(home + 5, home - 2, 3.4, ev, 0.22);
    }
    sararin(k0, k1, beat, ev, vel = 0.28) {
      const dir = k1 > k0 ? 1 : -1, n = Math.abs(k1 - k0), dt = 0.045 / this.spb;
      for (let i = 0; i <= n; i++) ev.push({ b: beat + i * dt, fn: 'koto', midi: this.midi(k0 + dir * i), vel: vel * (0.6 + (0.4 * i) / n), o: { pan: -0.5 + i / n } });
    }
    tremolo(k, pos, len, vel, ev) {
      const step = 0.125, n = Math.floor(len / 4 / step);
      for (let i = 0; i < n; i++) ev.push({ b: pos / 4 + i * step, fn: 'koto', midi: this.midi(k), vel: vel * (i % 2 ? 0.55 : 0.8) * (1 - i / (n * 2)), o: { damp: this.spb * step * 1.5 } });
    }
    shoChord(r) { return [this.midi(r + 5), this.midi(r + 7), this.midi(r + 8), this.midi(r + 10)]; }
    accomp(sec, bi, r, ev, intro, last) {
      const R = this.R, mood = this.tr.mood, bar = this.bar, isB = sec[0] === 'B';
      const K = (k, b, vel, o = {}) => ev.push({ b, fn: 'koto', midi: this.midi(k), vel, o });
      const D = (kind, b, vol) => ev.push({ b, fn: 'drum', kind, vol });
      switch (mood) {
        case 'calm':
          K(r, 0, 0.42, { pan: -0.3 }); K(r + 5, 0, 0.2, { pan: -0.3 });
          if (R() < 0.6) K(r + 3, 2, 0.26, { pan: -0.3 });
          if (bar % 2 === 0) ev.push({ b: 0, fn: 'sho', midis: this.shoChord(r), dur: 8, vol: 0.05 });
          if ((isB || sec === 'A3') && bar % 2 === 0) ev.push({ b: 0.5, fn: 'flute', midi: this.midi(10 + this.pick([0, 1, 2, -1, 3])), dur: 5, vol: 0.1 });
          break;
        case 'tense':
          for (let i = 0; i < 8; i++) K(r, i / 2, i % 2 ? 0.18 : 0.3, { damp: this.spb * 0.35, pan: -0.25 });
          D('don', 0, 0.38); D('don', 2.5, 0.22);
          if (bar % 2) D('ka', 3.5, 0.3);
          if (bar % 4 === 0) ev.push({ b: 0, fn: 'sho', midis: [this.midi(r + 5), this.midi(r + 6), this.midi(r + 8)], dur: 16, vol: 0.045 });
          break;
        case 'airy': {
          const P = [0, 3, 5, 8, 10, 8, 5, 3];
          for (let i = 0; i < 8; i++) K(r + P[i], i / 2, 0.18, { pan: i % 2 ? 0.5 : -0.5 });
          if (bar % 2 === 0) ev.push({ b: 0, fn: 'sho', midis: this.shoChord(r), dur: 8, vol: 0.045 });
          if (isB && bar % 2 === 0) ev.push({ b: 0.5, fn: 'flute', midi: this.midi(11 + this.pick([0, 1, -1, 2])), dur: 6, vol: 0.1 });
          if (bar % 4 === 2) ev.push({ b: 0, fn: 'wind', dur: 10, vol: 0.05 });
          break;
        }
        case 'playful':
          K(r, 0, 0.36, { pan: -0.3 }); K(r + 3, 1.5, 0.28, { pan: -0.3 }); K(r + 5, 3, 0.3, { pan: -0.3 });
          for (const b of [0.5, 1.5, 2.5, 3.5]) D('shime', b, 0.12);
          if (bar % 2 === 0) ev.push({ b: 0, fn: 'rin', midi: this.midi(15), vol: 0.05 });
          break;
        case 'ominous':
          K(r, 0, 0.5, { pan: -0.2 }); K(r + 5, 0, 0.26);
          if (bar % 2) K(r + 3, 2, 0.24);
          if (bar % 2 === 0) D('odaiko', 0, 0.55);
          if (bar % 4 === 3) D('don', 3.5, 0.3);
          if (bar % 4 === 0) ev.push({ b: 0, fn: 'sho', midis: [this.midi(r + 5), this.midi(r + 6), this.midi(r + 8), this.midi(r + 11)], dur: 16, vol: 0.05 });
          if (isB && bar % 4 === 1) ev.push({ b: 0, fn: 'flute', midi: this.midi(9 + this.pick([0, 1, 3])), dur: 7, vol: 0.09 });
          break;
        default: { // boss
          const P = this.tr.heavy ? [0, 0, 0, 3, 0, 0, 2, 3] : [0, 0, 3, 0, 5, 0, 3, 1];
          for (let i = 0; i < 8; i++) K(r + P[i], i / 2, i % 2 ? 0.22 : 0.34, { damp: this.spb * 0.35, pan: -0.15 });
          if (intro) {
            [0, 1, 2, 2.5, 3, 3.25, 3.5, 3.75].forEach((b, i) => D(bi === 1 && i > 3 ? 'ka' : 'don', b, 0.2 + i * 0.05));
            break;
          }
          if (this.tr.heavy) D('odaiko', 0, 0.55);
          for (const b of [0, 0.75, 2]) D('don', b, b === 0 ? 0.5 : 0.36);
          D('don', bi % 2 ? 3 : 3.5, 0.34);
          D('ka', 1, 0.32); D('ka', 3, 0.32);
          if (isB || sec === 'A3') for (let i = 0; i < 16; i++) D('shime', i / 4, i % 4 === 0 ? 0.16 : 0.07);
          if (last) { D('ka', 3.25, 0.3); D('don', 3.5, 0.4); D('don', 3.75, 0.45); }
        }
      }
      if (intro && bi === 0 && !this.boss) this.sararin(2, 12, 0, ev, 0.3);
      if (intro && bi === 0 && this.boss) this.sararin(14, 4, 0, ev, 0.3);
    }
  }

  function scheduleBar(ctx, out, comp, events, t0) {
    const spb = comp.spb;
    for (const e of events) {
      const t = Math.max(ctx.currentTime, t0 + e.b * spb + (e.fn === 'koto' ? Math.random() * 0.006 : 0));
      switch (e.fn) {
        case 'koto': koto(ctx, out.koto, t, e.midi, e.vel, e.o || {}); break;
        case 'sho': sho(ctx, out.out, t, e.midis, e.dur * spb, e.vol); break;
        case 'flute': flute(ctx, out.out, t, e.midi, e.dur * spb, e.vol); break;
        case 'drum': drum(ctx, out.out, t, e.kind, e.vol); break;
        case 'rin': rin(ctx, out.out, t, e.midi, e.vol); break;
        case 'wind': wind(ctx, out.out, t, e.dur * spb, e.vol); break;
      }
    }
  }

  // ------------------------------------------------------------------ realtime playback
  let cur = null, timer = null;
  function tick() {
    const ctx = Sound.ctx;
    if (!ctx || !cur) return;
    if (cur.nextT < ctx.currentTime) cur.nextT = ctx.currentTime + 0.05;
    while (cur.nextT < ctx.currentTime + 0.35) {
      scheduleBar(ctx, cur.out, cur.comp, cur.comp.nextBar(), cur.nextT);
      cur.nextT += cur.comp.barDur;
    }
  }
  function fadeOut(c, secs) {
    const ctx = Sound.ctx, g = c.out.out.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + secs);
    setTimeout(() => { try { c.out.out.disconnect(); } catch (e) { /* already gone */ } }, (secs + 4) * 1000);
  }
  function play(id) {
    const ctx = Sound.ctx;
    if (!ctx || !TRACKS[id] || (cur && cur.id === id)) return;
    if (cur) fadeOut(cur, 1.2);
    const out = trackOut(ctx, Sound.musBus);
    out.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.out.gain.exponentialRampToValueAtTime(MOOD_GAIN[TRACKS[id].mood] || 1, ctx.currentTime + 1.2);
    const comp = new Composer(TRACKS[id]);
    for (let k = 0; k < 16; k++) ksBuffer(ctx, comp.midi(k));
    cur = { id, comp, out, nextT: ctx.currentTime + 0.12 };
    if (!timer) timer = setInterval(tick, 50);
    tick();
  }
  function stop() { if (cur) { fadeOut(cur, 0.8); cur = null; } }

  // ------------------------------------------------------------------ offline render to .wav
  function encodeWav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const dv = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, len * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const v = clamp(data[c][i], -1, 1);
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
    return new Blob([dv], { type: 'audio/wav' });
  }
  async function renderWav(id, seconds = 90) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) throw new Error('Offline rendering is not supported in this browser.');
    const sr = 44100, oc = new OAC(2, Math.ceil(sr * seconds), sr);
    const master = oc.createGain(); master.gain.value = 0.9;
    master.gain.setValueAtTime(0.9, Math.max(0, seconds - 4)); master.gain.linearRampToValueAtTime(0, seconds);
    const comp = oc.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(oc.destination);
    const out = trackOut(oc, master);
    out.out.gain.value = MOOD_GAIN[TRACKS[id].mood] || 1;
    const c = new Composer(TRACKS[id]);
    for (let t = 0.05; t < seconds; t += c.barDur) scheduleBar(oc, out, c, c.nextBar(), t);
    return encodeWav(await oc.startRendering());
  }

  return {
    play, stop, renderWav,
    get current() { return cur ? cur.id : null; },
    list() { return Object.keys(TRACKS).map((id) => Object.assign({ id }, TRACKS[id])); },
    _Composer: Composer, // exposed for tests
  };
})();
