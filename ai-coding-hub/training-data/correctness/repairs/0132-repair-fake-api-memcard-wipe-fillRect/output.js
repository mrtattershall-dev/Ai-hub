export function wipe(ctx, progress, w, h, color = "#05060b") {
  const p = Math.max(0, Math.min(1, progress));
  ctx.fillStyle = color;
  // Diagonal bars sweeping in — a cheap but characterful transition.
  const bars = 10;
  const bw = w / bars;
  for (let i = 0; i < bars; i++) {
    const local = Math.max(0, Math.min(1, p * 1.6 - (i / bars) * 0.6));
    const bh = local * (h + 80);
    ctx.fillRect(i * bw, (i % 2 ? h - bh : -80 + bh - bh), bw + 1, h + 80);
    ctx.fillRect(i * bw, i % 2 ? h - bh : 0, bw + 1, bh);
  }
}