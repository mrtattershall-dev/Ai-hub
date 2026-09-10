export function drawBackdrop(ctx, world, cam, seed = 1) {
  // Sky gradient.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, world.skyTop ?? "#1a2444");
  g.addColorStop(1, world.skyBottom ?? "#05060b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Far layer: distant towers (slow parallax).
  drawSilhouettes(ctx, cam.x * 0.18, 0.18, seed, {
    count: 16, baseY: H * 0.62, minH: 120, maxH: 300, color: "rgba(40,52,90,0.55)", width: 90,
  });
  // Mid layer.
  drawSilhouettes(ctx, cam.x * 0.4, 0.4, seed * 3, {
    count: 22, baseY: H * 0.74, minH: 80, maxH: 220, color: "rgba(28,36,66,0.8)", width: 70,
  });

  // Distance fog band fading the far layers into the sky.
  const fog = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.85);
  const a = world.fog ?? 0.25;
  fog.addColorStop(0, `rgba(120,140,190,${a * 0.5})`);
  fog.addColorStop(1, "rgba(120,140,190,0)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);
}