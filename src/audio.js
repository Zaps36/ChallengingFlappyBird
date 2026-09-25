/**
 * audio.js — semua suara dibuat prosedural dengan Web Audio API.
 * Tidak ada file .mp3/.wav sama sekali, jadi repo tetap ringan
 * dan langsung jalan di GitHub Pages.
 */

const SCALES = {
  dawn:   [0, 4, 7, 11, 12, 14],
  day:    [0, 4, 7, 9, 12, 16],
  sunset: [0, 3, 7, 10, 12, 15],
  night:  [0, 3, 5, 7, 10, 12],
  storm:  [0, 2, 3, 7, 8, 12],
  void:   [0, 1, 5, 6, 8, 11],
};

export class AudioEngine {
  constructor(settings = { sfx: true, music: true }) {
    this.ctx = null;
    this.ready = false;
    this.sfxOn = settings.sfx !== false;
    this.musicOn = settings.music !== false;
    this.biome = 'dawn';
    this.intensity = 0;      // 0..1, makin tinggi makin rapat musiknya
    this._step = 0;
    this._nextNote = 0;
    this._timer = null;
    this._noiseBuf = null;
  }

  /** Harus dipanggil dari event gesture user (autoplay policy). */
  unlock() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.85 : 0;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.3 : 0;
      this.musicBus.connect(this.master);

      this.ready = true;
    } catch (e) {
      console.warn('[audio] tidak tersedia:', e);
    }
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ready) this.sfxBus.gain.value = on ? 0.85 : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.ready) this.musicBus.gain.value = on ? 0.3 : 0;
    if (!on) this.stopMusic();
  }

  /* =============== primitif =============== */
  get t() { return this.ctx.currentTime; }

  noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  tone({ freq = 440, to = null, dur = 0.12, type = 'square', vol = 0.3, bus = null, delay = 0, attack = 0.005, curve = 'exp' }) {
    if (!this.ready) return;
    const t0 = this.t + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (to && to !== freq) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 900, q = 1, type = 'lowpass', sweepTo = null, delay = 0 }) {
    if (!this.ready) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t0);
    filt.Q.value = q;
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* =============== SFX library =============== */
  play(name, opt = {}) {
    if (!this.ready || !this.sfxOn) return;
    switch (name) {
      case 'flap':
        this.noise({ dur: 0.1, vol: 0.16, freq: 1500, sweepTo: 420, type: 'bandpass', q: 0.8 });
        this.tone({ freq: 320, to: 520, dur: 0.07, type: 'triangle', vol: 0.12 });
        break;
      case 'coin':
        this.tone({ freq: 880, dur: 0.055, type: 'square', vol: 0.15 });
        this.tone({ freq: 1320, dur: 0.1, type: 'square', vol: 0.13, delay: 0.05 });
        break;
      case 'gem':
        [1046, 1318, 1568, 2093].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.11, type: 'triangle', vol: 0.14, delay: i * 0.045 }));
        break;
      case 'power':
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.14, type: 'square', vol: 0.13, delay: i * 0.05 }));
        break;
      case 'shoot':
        this.tone({ freq: 1250, to: 520, dur: 0.09, type: 'sawtooth', vol: 0.1 });
        this.noise({ dur: 0.07, vol: 0.1, freq: 2600, sweepTo: 800, type: 'highpass' });
        break;
      case 'kill':
        this.noise({ dur: 0.26, vol: 0.26, freq: 1100, sweepTo: 90 });
        this.tone({ freq: 220, to: 60, dur: 0.24, type: 'sawtooth', vol: 0.14 });
        break;
      case 'hurt':
        this.tone({ freq: 240, to: 70, dur: 0.34, type: 'sawtooth', vol: 0.22 });
        this.noise({ dur: 0.3, vol: 0.2, freq: 700, sweepTo: 70 });
        break;
      case 'dash':
        this.noise({ dur: 0.3, vol: 0.2, freq: 400, sweepTo: 3600, type: 'bandpass', q: 1.4 });
        this.tone({ freq: 180, to: 900, dur: 0.22, type: 'triangle', vol: 0.12 });
        break;
      case 'shieldHit':
        this.tone({ freq: 1800, to: 700, dur: 0.16, type: 'sine', vol: 0.18 });
        this.noise({ dur: 0.14, vol: 0.12, freq: 3000, type: 'highpass' });
        break;
      case 'alert':
        this.tone({ freq: 880, to: 1180, dur: 0.1, type: 'square', vol: 0.11 });
        this.tone({ freq: 880, to: 1180, dur: 0.1, type: 'square', vol: 0.11, delay: 0.13 });
        break;
      case 'bossWarn':
        [0, 0.34, 0.68].forEach((d) =>
          this.tone({ freq: 160, to: 150, dur: 0.26, type: 'square', vol: 0.2, delay: d, curve: 'lin' }));
        break;
      case 'laserCharge':
        this.tone({ freq: 160, to: 1500, dur: opt.dur || 0.9, type: 'sawtooth', vol: 0.1 });
        break;
      case 'laserFire':
        this.noise({ dur: 0.34, vol: 0.28, freq: 2400, sweepTo: 300, type: 'bandpass', q: 2 });
        break;
      case 'bossDown':
        [0, 0.12, 0.26, 0.42].forEach((d, i) =>
          this.noise({ dur: 0.5, vol: 0.26 - i * 0.04, freq: 1400 - i * 300, sweepTo: 60, delay: d }));
        [392, 523, 659, 784].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.3, type: 'square', vol: 0.12, delay: 0.4 + i * 0.1 }));
        break;
      case 'combo':
        this.tone({ freq: 700 + Math.min(4, opt.level || 1) * 180, dur: 0.1, type: 'triangle', vol: 0.12 });
        break;
      case 'revive':
        [523, 784, 1046, 1568].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.15, delay: i * 0.09 }));
        break;
      case 'nearMiss':
        this.noise({ dur: 0.16, vol: 0.12, freq: 2200, sweepTo: 600, type: 'bandpass', q: 3 });
        break;
      case 'biome':
        [392, 494, 587, 740].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.12, delay: i * 0.08 }));
        break;
      case 'buy':
        this.tone({ freq: 660, dur: 0.08, type: 'square', vol: 0.14 });
        this.tone({ freq: 990, dur: 0.14, type: 'square', vol: 0.13, delay: 0.08 });
        break;
      case 'deny':
        this.tone({ freq: 220, to: 130, dur: 0.18, type: 'square', vol: 0.15 });
        break;
      case 'ui':
        this.tone({ freq: 520, dur: 0.045, type: 'square', vol: 0.08 });
        break;
      case 'thunder':
        this.noise({ dur: 0.9, vol: 0.22, freq: 420, sweepTo: 50 });
        break;
      default:
        break;
    }
  }

  /* =============== musik prosedural =============== */
  startMusic(biome = 'dawn') {
    this.biome = biome;
    if (!this.ready || !this.musicOn || this._timer) return;
    this._step = 0;
    this._nextNote = this.t + 0.1;
    this._timer = setInterval(() => this._schedule(), 80);
  }

  stopMusic() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  setBiome(id) {
    this.biome = SCALES[id] ? id : 'day';
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  _schedule() {
    if (!this.ready || !this.musicOn) return;
    const lookahead = 0.25;
    const bpm = 96 + this.intensity * 42;
    const spb = 60 / bpm / 2; // 8th notes
    while (this._nextNote < this.t + lookahead) {
      this._note(this._nextNote, this._step);
      this._nextNote += spb;
      this._step++;
    }
  }

  _note(time, step) {
    const scale = SCALES[this.biome] || SCALES.day;
    const root = 130.81; // C3
    const semis = scale[(step * 3) % scale.length];
    const bassOn = step % 4 === 0;
    const leadOn = step % 2 === 1 && (step % 8 !== 3 || this.intensity > 0.4);

    if (bassOn) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root * Math.pow(2, semis / 12) / 2;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.5, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
      osc.connect(g);
      g.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + 0.3);
    }
    if (leadOn) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = this.biome === 'void' ? 'sine' : 'square';
      osc.frequency.value = root * 2 * Math.pow(2, semis / 12);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.14 + this.intensity * 0.1, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(g);
      g.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + 0.2);
    }
    // hi-hat tipis saat intensitas tinggi
    if (this.intensity > 0.35 && step % 2 === 0) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6500;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05 * this.intensity, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      src.connect(f); f.connect(g); g.connect(this.musicBus);
      src.start(time);
      src.stop(time + 0.06);
    }
  }
}

export default AudioEngine;
