function playNoise(opts) {
  if (!ctx || !ready || !noiseBuffer) return;
  const { start, dur, vol = 0.15, short = false, pan = 0 } = opts;
  /* We have one long-mode buffer; short-mode is a separate on-demand build */
  const buf = short ? buildNoiseBuffer(true) : noiseBuffer;

  const src  = ctx.createBufferSource();
  const gain = ctx.createGain();
  const qv   = q4(vol);

  src.buffer = buf;
  src.loop   = true;

  gain.gain.setValueAtTime(qv, start);
  gain.gain.setValueAtTime(qv, start + dur * 0.6);
  gain.gain.linearRampToValueAtTime(0, start + dur);

  src.connect(gain);

  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, start);
    gain.connect(panner);
    panner.connect(masterGain);
  } else {
    gain.connect(masterGain);
  }

  src.start(start);
  src.stop(start + dur + 0.02);
}