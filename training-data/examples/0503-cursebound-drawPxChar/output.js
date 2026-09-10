function drawPxChar(ctx, ch, x, y, scale) {
  const g = FONT5X7[ch.toUpperCase()] || FONT5X7['?'];
  const s = scale || 1;
  for (let row = 0; row < 7; row++) {
    const bits = g[row] || 0;
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) {
        ctx.fillRect(x + col * s, y + row * s, s, s);
      }
    }
  }
}