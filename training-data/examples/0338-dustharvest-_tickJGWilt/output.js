function _tickJGWilt() {
  if (typeof gameState._jgDebt === 'undefined') return; // not in jungle yet
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled || !p.crop) continue;
    const cropDef = CROPS[p.crop];
    if (cropDef?.noWater) continue;
    if (p.harvestReady) continue;
    if (!p.wateredToday) {
      if (p.wilted) {
        // Second unwilted day — crop dies
        const [ktx, kty] = key.split(',').map(Number);
        spawnParticles(ktx * JG_T + JG_T / 2, kty * JG_T + JG_T / 2, '#5a3a1a', 4, '💀');
        p.crop = null; p.growthProgress = 0; p.harvestReady = false;
        p.wilted = false; p.watered = false; p.wateredToday = false;
        // Remain tilled — the player doesn't have to re-till
        stats.cropsDiedToThirst++;
      } else {
        p.wilted = true;
      }
    } else {
      p.wilted = false;
    }
  }
  // Reset wateredToday at dawn for all jungle plots
  for (const key in jgPlots) {
    if (jgPlots[key].tilled) jgPlots[key].wateredToday = false;
  }
}