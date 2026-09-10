export function drawForegroundFog(ctx, world) {
  if (!world.fog) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(10,7,16,${0.3 + world.fog * 0.4})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}