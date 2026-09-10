function rollFishCatchWithBonuses(table, total) {
  const rod = getRodBonus();
  const bait = getBaitBonus();

  // Build adjusted weight table
  let adjusted = table.map(f => {
    let w = f.weight;
    // Rod tier boosts rare fish (weight < 10)
    if (f.weight <= 6)  w *= rod.rareMult;
    else if (f.weight <= 12) w *= (1 + (rod.rareMult - 1) * 0.5);
    // Bait bonus
    if (bait && bait.ids.includes(f.id)) w *= bait.mult;
    return { ...f, weight: w };
  });
  const adjTotal = adjusted.reduce((s, f) => s + f.weight, 0);
  return rollFishCatch(adjusted, adjTotal);
}