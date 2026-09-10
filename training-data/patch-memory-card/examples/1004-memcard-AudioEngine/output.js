export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.volumes = { ...CONFIG.audio };
    this._noiseBuffer = null;

    // Music scheduler state
    this._current = null;
    this._step = 0;
    this._nextNoteTime = 0;
    this._timer = null;
    this._lookahead = 0.025; // seconds between scheduler wakeups
    this._scheduleAhead = 0.12; // how far ahead to queue notes
  }

  /** Lazily create the context. Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this._noiseBuffer = this._makeNoise();
    this.ready = true;
  }

  setVolume(kind, value) {
    this.volumes[kind] = value;
    if (!this.ready) return;
    ({ master: this.master, sfx: this.sfxGain, music: this.musicGain })[kind]
      .gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  // ---- low-level voices ---------------------------------------------------

  _makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A single enveloped oscillator "blip", optionally pitch-swept. */
  _blip({ freq = 440, type = "square", dur = 0.12, vol = 0.3, sweep = 0, dest }) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005); // fast attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur); // decay
    osc.connect(gain).connect(dest ?? this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A filtered noise burst (impacts, dashes, explosions). */
  _noise({ dur = 0.18, vol = 0.3, cutoff = 1800, type = "lowpass" }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(gain).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  // ---- named SFX presets --------------------------------------------------

  /** Play a named sound effect. Unknown names are ignored safely. */
  sfx(name) {
    if (!this.ready) return;
    switch (name) {
      case "cursor": return this._blip({ freq: 520, type: "square", dur: 0.05, vol: 0.18 });
      case "confirm": this._blip({ freq: 660, dur: 0.08, vol: 0.22 });
        return this._blip({ freq: 990, dur: 0.12, vol: 0.18, sweep: 200 });
      case "cancel": return this._blip({ freq: 300, type: "square", dur: 0.1, vol: 0.2, sweep: -120 });
      case "jump": return this._blip({ freq: 380, type: "square", dur: 0.14, vol: 0.18, sweep: 360 });
      case "doublejump": return this._blip({ freq: 520, type: "square", dur: 0.14, vol: 0.18, sweep: 420 });
      case "land": return this._noise({ dur: 0.08, vol: 0.18, cutoff: 700 });
      case "dodge": return this._noise({ dur: 0.18, vol: 0.22, cutoff: 2200, type: "bandpass" });
      case "light": this._blip({ freq: 700, type: "sawtooth", dur: 0.06, vol: 0.16, sweep: -200 });
        return this._noise({ dur: 0.05, vol: 0.12, cutoff: 3000 });
      case "heavy": this._blip({ freq: 320, type: "sawtooth", dur: 0.12, vol: 0.2, sweep: -120 });
        return this._noise({ dur: 0.1, vol: 0.18, cutoff: 1400 });
      case "slam": this._noise({ dur: 0.3, vol: 0.32, cutoff: 600 });
        return this._blip({ freq: 140, type: "sine", dur: 0.3, vol: 0.25, sweep: -80 });
      case "shoot": return this._blip({ freq: 880, type: "square", dur: 0.1, vol: 0.16, sweep: -500 });
      case "hit": this._noise({ dur: 0.08, vol: 0.24, cutoff: 2600 });
        return this._blip({ freq: 200, type: "square", dur: 0.06, vol: 0.14, sweep: -60 });
      case "hurt": return this._blip({ freq: 180, type: "sawtooth", dur: 0.22, vol: 0.26, sweep: -80 });
      case "pickup": return this._blip({ freq: 880, dur: 0.08, vol: 0.16, sweep: 220 });
      case "shard": return this._blip({ freq: 1040, type: "triangle", dur: 0.07, vol: 0.14, sweep: 180 });
      case "emblem": this._blip({ freq: 784, dur: 0.1, vol: 0.18 });
        setTimeout(() => this._blip({ freq: 1175, dur: 0.16, vol: 0.18, sweep: 200 }), 90);
        return;
      case "heart": this._blip({ freq: 660, dur: 0.1, vol: 0.18 });
        setTimeout(() => this._blip({ freq: 990, dur: 0.18, vol: 0.18 }), 80);
        return;
      case "rankup": [0, 120, 240].forEach((d, i) =>
        setTimeout(() => this._blip({ freq: mtof(72 + i * 4), dur: 0.2, vol: 0.2 }), d));
        return;
      case "door": return this._noise({ dur: 0.4, vol: 0.2, cutoff: 900, type: "lowpass" });
      case "death": [0, 140, 280].forEach((d, i) =>
        setTimeout(() => this._blip({ freq: mtof(60 - i * 5), type: "sawtooth", dur: 0.3, vol: 0.22, sweep: -60 }), d));
        return;
      default: return;
    }
  }

  // ---- music scheduler ----------------------------------------------------

  playMusic(name) {
    if (!this.ready || this._current === name) return;
    this.stopMusic();
    this._current = name;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.05;
    this._timer = setInterval(() => this._scheduler(), this._lookahead * 1000);
  }

  stopMusic() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._current = null;
  }

  _scheduler() {
    const track = TRACKS[this._current];
    if (!track) return;
    const stepDur = 60 / track.bpm / 4; // sixteenth note
    while (this._nextNoteTime < this.ctx.currentTime + this._scheduleAhead) {
      this._scheduleStep(track, this._step, this._nextNoteTime);
      this._nextNoteTime += stepDur;
      this._step = (this._step + 1) % 16;
    }
  }

  _scheduleStep(track, step, when) {
    const stepDur = 60 / track.bpm / 4;
    const bass = track.bass[step];
    const lead = track.lead[step];
    if (bass != null) this._noteAt(mtof(bass), track.waveBass, when, stepDur * 1.9, track.bassVol);
    if (lead != null) this._noteAt(mtof(lead), track.waveLead, when, stepDur * 0.9, track.leadVol);
  }

  /** Schedule a single music note at an absolute audio time. */
  _noteAt(freq, type, when, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  get currentTrack() {
    return this._current;
  }
}