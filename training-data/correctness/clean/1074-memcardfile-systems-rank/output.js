/**
 * rank.js — end-of-stage rank computation (D .. SS).
 *
 * Pure scoring: given the stats tracked during a stage and the stage's par
 * targets, produce a 0..100 score per dimension, blend by the configured
 * weights, and map the result onto a tier. Keeping this pure (no rendering, no
 * state) makes the rank rules easy to read, test, and rebalance from one place.
 *
 * @module systems/rank
 */

import { CONFIG } from "../config.js";
import { clamp } from "../engine/mathx.js";

/**
 * @typedef {object} StageStats
 * @property {number} time      seconds taken
 * @property {number} damage    health lost
 * @property {number} kills     enemies defeated
 * @property {number} secrets   secrets found
 * @property {number} style     peak style/combo points
 */

/**
 * @typedef {object} StagePar  per-stage targets from levels.json
 * @property {number} parTime     time that scores full marks
 * @property {number} maxDamage   damage budget before time score floors
 * @property {number} totalKills  enemies available
 * @property {number} totalSecrets
 * @property {number} styleTarget style needed for full style score
 */

/**
 * @param {StageStats} stats
 * @param {StagePar} par
 * @returns {{tier:string, score:number, breakdown:Record<string,number>}}
 */
export function computeRank(stats, par) {
  const w = CONFIG.rank.weights;

  // Each sub-score is 0..1, higher is better.
  const timeScore = clamp(par.parTime / Math.max(stats.time, 1), 0, 1);
  const damageScore = clamp(1 - stats.damage / Math.max(par.maxDamage, 1), 0, 1);
  const killScore = par.totalKills > 0
    ? clamp(stats.kills / par.totalKills, 0, 1)
    : 1;
  const secretScore = par.totalSecrets > 0
    ? clamp(stats.secrets / par.totalSecrets, 0, 1)
    : 1;
  const styleScore = clamp(stats.style / Math.max(par.styleTarget, 1), 0, 1);

  const score = Math.round(
    (timeScore * w.time +
      damageScore * w.damage +
      killScore * w.kills +
      secretScore * w.secrets +
      styleScore * w.style) * 100
  );

  const tier = CONFIG.rank.tiers.find((t) => score >= t.min)?.tier ?? "D";

  return {
    tier,
    score,
    breakdown: {
      time: Math.round(timeScore * 100),
      damage: Math.round(damageScore * 100),
      kills: Math.round(killScore * 100),
      secrets: Math.round(secretScore * 100),
      style: Math.round(styleScore * 100),
    },
  };
}

/** Color used to paint each rank tier in the results screen. */
export function rankColor(tier) {
  return {
    SS: "#ff5d8f",
    S: "#ffd86b",
    A: "#4fd1ff",
    B: "#7dffb0",
    C: "#b8c0e0",
    D: "#8b95b8",
  }[tier] ?? "#fff";
}
