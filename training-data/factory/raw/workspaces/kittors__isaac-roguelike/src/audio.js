// 所有音效都用 WebAudio 实时合成，没有音频文件。
// 以撒的音效核心是「湿润的肉感」——低频噪声 + 快速衰减包络。

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.musicOn = true;
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.step = 0;
  }

  /** 浏览器要求首次交互后才能开音频 */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    // 预生成一段白噪声，供各种打击音复用
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  get now() { return this.ctx.currentTime; }

  /** 噪声击打：滤波 + 指数衰减 */
  noise(o = {}) {
    const t = this.now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = o.rate || 1;

    const filt = this.ctx.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqEnd), t + (o.dur || 0.15));
    filt.Q.value = o.q || 1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain || 0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.15));

    src.connect(filt); filt.connect(g); g.connect(o.dest || this.sfxGain);
    src.start(t);
    src.stop(t + (o.dur || 0.15) + 0.02);
  }

  /** 音调：可做频率滑动 */
  tone(o = {}) {
    const t = this.now;
    const osc = this.ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + (o.dur || 0.15));

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.15));

    osc.connect(g); g.connect(o.dest || this.sfxGain);
    osc.start(t + (o.delay || 0));
    osc.stop(t + (o.dur || 0.15) + (o.delay || 0) + 0.02);
  }

  play(name) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const r = (a, b) => a + Math.random() * (b - a);

    switch (name) {
      case 'shoot':          // 眼泪：短促的水滴声
        this.tone({ type: 'sine', freq: r(680, 780), freqEnd: 240, dur: 0.09, gain: 0.14 });
        this.noise({ freq: 2400, freqEnd: 700, dur: 0.06, gain: 0.06, q: 2 });
        break;
      case 'shoot_enemy':
        this.tone({ type: 'square', freq: r(240, 300), freqEnd: 120, dur: 0.1, gain: 0.07 });
        break;
      case 'hit':            // 打中肉体
        this.noise({ freq: r(700, 1000), freqEnd: 260, dur: 0.08, gain: 0.18, q: 1.4 });
        break;
      case 'splat':          // 死亡的爆浆
        this.noise({ freq: 500, freqEnd: 90, dur: 0.28, gain: 0.3, q: 0.7, filter: 'lowpass' });
        this.tone({ type: 'sine', freq: 160, freqEnd: 50, dur: 0.2, gain: 0.12 });
        break;
      case 'hurt':           // 以撒挨打：一声哀鸣
        this.tone({ type: 'sawtooth', freq: 520, freqEnd: 180, dur: 0.3, gain: 0.16 });
        this.tone({ type: 'sine', freq: 780, freqEnd: 240, dur: 0.34, gain: 0.1, delay: 0.02 });
        break;
      case 'explode':
        this.noise({ freq: 900, freqEnd: 60, dur: 0.55, gain: 0.4, q: 0.5, filter: 'lowpass' });
        this.tone({ type: 'sine', freq: 110, freqEnd: 28, dur: 0.5, gain: 0.28 });
        break;
      case 'rockbreak':
        this.noise({ freq: 1800, freqEnd: 400, dur: 0.18, gain: 0.22, q: 1.2 });
        break;
      case 'coin':
        this.tone({ type: 'square', freq: 1050, dur: 0.06, gain: 0.1 });
        this.tone({ type: 'square', freq: 1560, dur: 0.12, gain: 0.09, delay: 0.05 });
        break;
      case 'heart':
        this.tone({ type: 'sine', freq: 620, dur: 0.1, gain: 0.14 });
        this.tone({ type: 'sine', freq: 930, dur: 0.16, gain: 0.11, delay: 0.07 });
        break;
      case 'pickup':
        this.tone({ type: 'triangle', freq: 780, freqEnd: 1100, dur: 0.1, gain: 0.12 });
        break;
      case 'powerup':        // 拿到道具：一段上行琶音
        [523, 659, 784, 1047].forEach((f, i) => {
          this.tone({ type: 'triangle', freq: f, dur: 0.3, gain: 0.13, delay: i * 0.075 });
        });
        break;
      case 'doorOpen':
        this.noise({ freq: 320, freqEnd: 120, dur: 0.4, gain: 0.16, q: 0.8, filter: 'lowpass' });
        this.tone({ type: 'sine', freq: 90, dur: 0.35, gain: 0.1 });
        break;
      case 'jump':
        this.tone({ type: 'sine', freq: 200, freqEnd: 460, dur: 0.18, gain: 0.12 });
        break;
      case 'slam':
        this.noise({ freq: 400, freqEnd: 50, dur: 0.35, gain: 0.34, q: 0.6, filter: 'lowpass' });
        this.tone({ type: 'sine', freq: 80, freqEnd: 30, dur: 0.3, gain: 0.3 });
        break;
      case 'thud':
        this.noise({ freq: 250, freqEnd: 60, dur: 0.2, gain: 0.2, filter: 'lowpass' });
        break;
      case 'growl':
        this.tone({ type: 'sawtooth', freq: 90, freqEnd: 150, dur: 0.32, gain: 0.1 });
        break;
      case 'buzz':
        this.tone({ type: 'sawtooth', freq: 220, freqEnd: 180, dur: 0.3, gain: 0.06 });
        break;
      case 'laser':
        this.tone({ type: 'sawtooth', freq: 1400, freqEnd: 400, dur: 0.14, gain: 0.1 });
        break;
      case 'brimstone':
        this.tone({ type: 'sawtooth', freq: 180, freqEnd: 60, dur: 0.55, gain: 0.22 });
        this.noise({ freq: 600, freqEnd: 100, dur: 0.5, gain: 0.16, filter: 'lowpass' });
        break;
      case 'place':
        this.tone({ type: 'sine', freq: 300, freqEnd: 190, dur: 0.1, gain: 0.12 });
        break;
      case 'use':
        [660, 880].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.2, gain: 0.12, delay: i * 0.06 }));
        break;
      case 'revive':
        [392, 523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ type: 'sine', freq: f, dur: 0.5, gain: 0.14, delay: i * 0.09 }));
        break;
      case 'unlock':
        this.noise({ freq: 2600, freqEnd: 900, dur: 0.12, gain: 0.14, q: 3 });
        this.tone({ type: 'square', freq: 900, dur: 0.08, gain: 0.08 });
        break;
      case 'deny':
        this.tone({ type: 'square', freq: 180, freqEnd: 120, dur: 0.14, gain: 0.1 });
        break;
      case 'stairs':
        [523, 392, 330, 262].forEach((f, i) =>
          this.tone({ type: 'sine', freq: f, dur: 0.4, gain: 0.14, delay: i * 0.1 }));
        break;
      case 'death':
        [330, 262, 196, 131].forEach((f, i) =>
          this.tone({ type: 'sawtooth', freq: f, dur: 0.8, gain: 0.16, delay: i * 0.18 }));
        break;
      case 'bossIntro':
        this.tone({ type: 'sawtooth', freq: 55, dur: 1.4, gain: 0.25 });
        this.noise({ freq: 300, freqEnd: 80, dur: 1.2, gain: 0.16, filter: 'lowpass' });
        break;
      default: break;
    }
  }

  // --- 氛围音乐：一段缓慢的小调循环，靠琶音和低音鼓营造地下室的压抑感 ---
  startMusic(chapterIndex = 0) {
    if (!this.enabled || !this.musicOn) return;
    this.ensure();
    if (!this.ctx) return;
    this.stopMusic();
    // 每章换一个调式，越深越阴暗
    const roots = [110, 98, 87.31, 82.41];
    const root = roots[chapterIndex % roots.length];
    const scale = [0, 3, 5, 7, 10];   // 小调五声
    const seq = [0, 2, 1, 4, 3, 1, 2, 0];
    this.step = 0;

    const beat = 0.42;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const s = this.step++;
      const deg = scale[seq[s % seq.length]];
      const f = root * Math.pow(2, deg / 12);

      // 低音
      if (s % 4 === 0) {
        this.tone({ type: 'triangle', freq: root / 2, dur: beat * 3, gain: 0.16, attack: 0.02, dest: this.musicGain });
      }
      // 主旋律：轻柔的三角波
      this.tone({ type: 'triangle', freq: f * 2, dur: beat * 1.6, gain: 0.07, attack: 0.03, dest: this.musicGain });
      // 泛音层
      if (s % 2 === 0) {
        this.tone({ type: 'sine', freq: f * 4, dur: beat * 2.2, gain: 0.035, attack: 0.08, dest: this.musicGain });
      }
      // 心跳般的低鼓
      if (s % 8 === 0 || s % 8 === 3) {
        this.noise({ freq: 160, freqEnd: 50, dur: 0.2, gain: 0.1, filter: 'lowpass', dest: this.musicGain });
      }
    }, beat * 1000);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (!this.musicOn) this.stopMusic();
    return this.musicOn;
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    return this.enabled;
  }
}
