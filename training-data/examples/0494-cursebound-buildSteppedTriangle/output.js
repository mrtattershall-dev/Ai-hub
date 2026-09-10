function buildSteppedTriangle() {
  /* 32-step 4-bit triangle — matches 2A03 DAC staircase output */
  const S = 32;
  const real = new Float32Array(S);
  const imag = new Float32Array(S);
  for (let i = 1; i < S; i += 2) {
    imag[i] = (8 / Math.pow(Math.PI * i, 2)) * (i % 4 === 1 ? 1 : -1);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}