function drawStyleMeter(ctx, player) {
  const x = W - 220;
  const y = 70;
  const ranks = [
    { min: 0, label: "" },
    { min: 40, label: "NICE" },
    { min: 90, label: "GREAT" },
    { min: 150, label: "STYLISH" },
    { min: 220, label: "SAVAGE!" },
    { min: 320, label: "ARCHIVE-BREAKER!" },
  ];
  const cur = [...ranks].reverse().find((r) => player.style >= r.min);
  if (player.style < 10) return;

  const pulse = 1 + Math.sin(performance.now() / 120) * 0.04;
  ctx.save();
  ctx.globalAlpha = Math.min(1, player.style / 40);
  text(ctx, cur.label, W - 20, y, {
    size: 26 * pulse, align: "right", weight: 800,
    color: player.style > 220 ? "#ff5d8f" : "#ffd86b",
  });
  // Meter bar shrinking as style decays.
  const seg = (player.style % 100) / 100;
  bar(ctx, x, y + 10, 200, 8, seg, "#ffd86b");
  ctx.restore();
}