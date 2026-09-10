function _getJGFarmSummary() {
  let tilled = 0, growing = 0, ready = 0, stripped = 0, recovering = 0, restored = 0;
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled) continue;
    tilled++;
    if (p.soilTier === 'stripped')   stripped++;
    if (p.soilTier === 'recovering') recovering++;
    if (p.soilTier === 'restored')   restored++;
    if (p.crop && !p.harvestReady)   growing++;
    if (p.harvestReady)              ready++;
  }
  return { tilled, growing, ready, stripped, recovering, restored };
}