function playNote(opts) {
  if (!ctx || !ready) return null;
  const {
    wave     = waveP25,
    freq,
    start,
    dur,
    vol      = 0.2,
    vibrato  = false,
    vibratoDepth = 0.3,   /* semitones */
    sweep    = null,
    pan      = 0,
    loop     = false,
  } = opts;

  if (!freq || freq <= 0) return null;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  if (wave) osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(freq, start);

  /* 4-bit staccato envelope */
  const qv = q4(vol);
  gain.gain.setValueAtTime(qv, start);
  gain.gain.setValueAtTime(qv,     start + dur * 0.80);
  gain.gain.linearRampToValueAtTime(0, start + dur * 0.98);

  /* 60Hz vibrato — alternating frame-rate pitch steps */
  if (vibrato) {
    const fHi  = freq * Math.pow(2,  vibratoDepth / 12);
    const fLo  = freq * Math.pow(2, -vibratoDepth / 12);
    const step = 1 / 60;
    const frames = Math.floor(dur / step);
    for (let i = 0; i < frames; i++) {
      osc.frequency.setValueAtTime(
        i % 2 === 0 ? fHi : fLo,
        start + i * step
      );
    }
  }

  /* Hardware sweep (60Hz stepping, asymmetric for descending — 1's complement bug) */
  if (sweep) {
    const steps = Math.max(1, Math.floor(sweep.dur * 60));
    const delta = (sweep.target - freq) / steps;
    let   cur   = freq;
    for (let i = 0; i < steps; i++) {
      const bug = (sweep.target < freq) ? cur * 0.005 : 0;
      osc.frequency.setValueAtTime(cur + bug, start + i / 60);
      cur += delta;
    }
  }

  /* Routing: osc → gain → [panner →] master */
  osc.connect(gain);
  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), start);
    gain.connect(panner);
    panner.connect(masterGain);
  } else {
    gain.connect(masterGain);
  }

  osc.start(start);
  osc.stop(start + dur + 0.02);

  return gain;
}