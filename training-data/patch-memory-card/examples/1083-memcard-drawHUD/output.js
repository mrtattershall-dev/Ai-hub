export function drawHUD(ctx, app, player, stats) {
  // ---- Health (top-left) ----
  panel(ctx, 16, 14, 250, 56, { glow: 8 });
  text(ctx, "VITALITY", 30, 34, { size: 12, color: "#8b95b8" });
  const hpPct = player.hp / player.maxHp;
  const hpColor = hpPct < 0.3 ? (Math.sin(performance.now() / 100) > 0 ? "#ff5d8f" : "#ff90b0") : "#7dffb0";
  bar(ctx, 30, 42, 222, 16, hpPct, hpColor);
  text(ctx, `${Math.ceil(player.hp)} / ${player.maxHp}`, 141, 54, {
    size: 12, color: "#0a0e1c", align: "center", weight: 700, shadow: false,
  });

  // ---- Shards (top-left, below health) ----
  panel(ctx, 16, 78, 150, 40, { glow: 6 });
  ctx.fillStyle = "#4fd1ff";
  ctx.save();
  ctx.translate(38, 98);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  text(ctx, `${app.progression.data.shards}`, 58, 104, { size: 20, weight: 700 });

  // ---- Style / combo meter (right) ----
  drawStyleMeter(ctx, player);

  // ---- Timer (top-center) ----
  const time = formatStopwatch(stats.time);
  panel(ctx, W / 2 - 70, 14, 140, 40, { glow: 6 });
  text(ctx, time, W / 2, 40, { size: 22, align: "center", weight: 700, color: "#e8edff" });

  // ---- Secrets / kills mini readout (top-right corner) ----
  text(ctx, `SECRETS ${stats.secrets}/${stats.totalSecrets}`, W - 20, 26, {
    size: 12, align: "right", color: "#ffd86b",
  });
  text(ctx, `FOES ${stats.kills}/${stats.totalKills}`, W - 20, 44, {
    size: 12, align: "right", color: "#ff9a8a",
  });

  // ---- Cooldown pip for the ranged burst ----
  if (player.burstCooldown > 0) {
    const cd = 1 - player.burstCooldown / app.progression.burstCooldown();
    bar(ctx, 16, 124, 100, 8, cd, "#b06bff");
    text(ctx, "BURST", 120, 132, { size: 10, color: "#8b95b8" });
  } else {
    text(ctx, "BURST READY", 16, 132, { size: 11, color: "#b06bff" });
  }
}