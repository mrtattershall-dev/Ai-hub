function getRodBonus() {
  // Returns { castMult, rareMult } based on rod tier
  const t = player._rodTier || 0;
  const mults = [
    { castMult:1.0, rareMult:1.0 }, // bamboo
    { castMult:0.88, rareMult:1.2 }, // cane
    { castMult:0.75, rareMult:1.5 }, // copper
    { castMult:0.62, rareMult:1.9 }, // iron
    { castMult:0.50, rareMult:2.5 }, // gold
  ];
  return mults[Math.min(t, 4)];
}