function buildNoiseBuffer(shortMode) {
  /* One second worth of samples; scheduler loops as needed */
  const len  = SR;
  const buf  = ctx.createBuffer(1, len, SR);
  const data = buf.getChannelData(0);
  let   reg  = 0x0001;

  for (let i = 0; i < len; i++) {
    const tap  = shortMode ? 6 : 1;
    const b0   = reg & 1;
    const bN   = (reg >> tap) & 1;
    const feed = b0 ^ bN;
    reg = (reg >> 1) | (feed << 14);
    data[i] = b0 ? 1.0 : -1.0;
  }
  return buf;
}