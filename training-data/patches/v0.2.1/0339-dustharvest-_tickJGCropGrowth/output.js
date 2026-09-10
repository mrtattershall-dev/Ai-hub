function _tickJGCropGrowth(dt) {
  if (!gameState.inJungle) return; // only grow when player is in jungle (same as how frontier works)
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled || !p.crop || p.harvestReady || p.wilted) continue;
    const cropDef = CROPS[p.crop];
    if (!cropDef) continue;
    if (!p.wateredToday && !cropDef.noWater) continue;

    const growSecs = (REAL_GROW_SECONDS[p.crop] || 720) / (getEffectiveGrowMult() * JG_SOIL_GROW_MULT[p.soilTier || 'stripped']);
    let rate = 1 / growSecs;

    // Cane Reed trait: each adjacent cane reed gives +20% growth rate
    if (p.crop !== 'caneReed') {
      const [ktx, kty] = key.split(',').map(Number);
      let reedCount = 0;
      for (const [ddx, ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nk = jgPlotKey(ktx + ddx, kty + ddy);
        if (jgPlots[nk]?.crop === 'caneReed' && !jgPlots[nk].wilted) reedCount++;
      }
      if (reedCount > 0) rate *= 1 + reedCount * 0.20;
    }

    // Darkroot: glows at night, reveals jungle fog
    if (p.crop === 'darkroot' && gameState.isNight) {
      const [ktx, kty] = key.split(',').map(Number);
      p._glowRevealTimer = (p._glowRevealTimer || 0) - dt;
      if (p._glowRevealTimer <= 0) {
        p._glowRevealTimer = 1.5;
        revealAround(ktx * JG_T + JG_T/2, kty * JG_T + JG_T/2, 5, exploredJungle, JG_W, JG_H);
      }
    }

    p.growthProgress = Math.min(1, p.growthProgress + rate * dt);
    if (p.growthProgress >= 1) p.harvestReady = true;
  }
}