/**
 * hud.js — the in-stage heads-up display.
 *
 * Pure presentation: reads the player and the level's run-stats and paints the
 * health bar, shard counter, style/combo meter, timer, and contextual prompts.
 * Animated bits (style meter pulse, low-health flash) live here so the renderer
 * owns all the "juice" rather than scattering it through gameplay code.
 *
 * @module ui/hud
 */

import { panel, text, bar, roundRect } from "./widgets.js";
import { CONFIG } from "../config.js";

const W = CONFIG.view.width;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} app
 * @param {import('../entities/player.js').Player} player
 * @param {object} stats run stats from the level scene
 */
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

/** Contextual "press E" style prompt, centered above a target. */
export function drawPrompt(ctx, label, screenX, screenY) {
  ctx.save();
  const w = ctx.measureText(label).width + 40;
  panel(ctx, screenX - w / 2, screenY - 44, w, 30, { glow: 6, radius: 8 });
  text(ctx, label, screenX, screenY - 24, { size: 14, align: "center", baseline: "middle" });
  ctx.restore();
}

function formatStopwatch(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

export { formatStopwatch };
