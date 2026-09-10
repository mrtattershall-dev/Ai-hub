function buildPulse(duty) {
  const H = 64;
  const real = new Float32Array(H);
  const imag = new Float32Array(H);
  for (let i = 1; i < H; i++) {
    /* Hanning window: w(i) = 0.5*(1 - cos(π*i/(H-1))) */
    const w = 0.5 * (1 - Math.cos(Math.PI * i / (H - 1)));
    imag[i] = w * (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}