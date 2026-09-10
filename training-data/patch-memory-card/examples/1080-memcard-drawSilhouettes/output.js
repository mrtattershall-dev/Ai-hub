function drawSilhouettes(ctx, offsetX, _factor, seed, opts) {
  const spacing = opts.width + 30;
  const start = Math.floor(offsetX / spacing) - 1;
  for (let i = 0; i < opts.count + 2; i++) {
    const idx = start + i;
    const r = hash(idx * 1.7 + seed);
    const h = opts.minH + r * (opts.maxH - opts.minH);
    const x = idx * spacing - offsetX;
    ctx.fillStyle = opts.color;
    ctx.fillRect(x, opts.baseY - h, opts.width, h);
    // A couple of lit windows for character.
    ctx.fillStyle = "rgba(255,216,107,0.10)";
    const rows = Math.floor(h / 40);
    for (let w = 0; w < rows; w++) {
      if (hash(idx * 9.1 + w + seed) > 0.7) {
        ctx.fillRect(x + 12 + (w % 2) * 30, opts.baseY - h + 14 + w * 36, 14, 14);
      }
    }
  }
}