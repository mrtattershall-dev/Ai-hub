function drawTitleLightningBolt(ctx, points, color, coreColor) {
  ctx.fillStyle = color;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) | 0;
    for (let s = 0; s <= steps; s++) {
      const x = (a.x + dx * (s / Math.max(1, steps))) | 0;
      const y = (a.y + dy * (s / Math.max(1, steps))) | 0;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
  ctx.fillStyle = coreColor;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) | 0;
    for (let s = 0; s <= steps; s++) {
      const x = (a.x + dx * (s / Math.max(1, steps))) | 0;
      const y = (a.y + dy * (s / Math.max(1, steps))) | 0;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}