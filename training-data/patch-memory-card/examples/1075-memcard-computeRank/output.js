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