export function drawPrompt(ctx, label, screenX, screenY) {
  ctx.save();
  const w = ctx.measureText(label).width + 40;
  panel(ctx, screenX - w / 2, screenY - 44, w, 30, { glow: 6, radius: 8 });
  text(ctx, label, screenX, screenY - 24, { size: 14, align: "center", baseline: "middle" });
  ctx.restore();
}