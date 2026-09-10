function _jgPlant(tx, ty, key, wx, wy) {
  const p = jgPlots[key];
  if (!p || !p.tilled) { showMsg('⚠️ Till this soil first!'); return true; }
  if (p.crop) { showMsg('Already planted here.'); return true; }

  const cropId = gameState._jgSelectedSeed || 'heartleaf';
  if (getJGSeedCount(cropId) <= 0) {
    showMsg(`⚠️ No ${CROPS[cropId]?.name || cropId} seeds — buy from Tobias.`);
    return true;
  }

  // Ashgrain: stripped/recovering soil only (reclamation crop — doesn't grow in fully restored land)
  if (cropId === 'ashgrain' && p.soilTier === 'restored') {
    showMsg('🌾 Ashgrain only grows on stripped or recovering soil.');
    return true;
  }
  if (cropId === 'canopyMelon') {
    // Shade check at plant time — needs at least one adjacent tree or dense-tree tile
    let hasShade = false;
    for (const [ddx, ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const t = getJGT(tx + ddx, ty + ddy);
      if (t === JG.TREE || t === JG.DENSE_TREE) { hasShade = true; break; }
    }
    if (!hasShade) {
      showMsg('🍈 Canopy Melon needs shade — plant adjacent to a jungle tree tile.');
      return true;
    }
  }
  // Darkroot only on recovering or restored (deep soil)
  if (cropId === 'darkroot' && p.soilTier === 'stripped') {
    showMsg('🟤 Darkroot needs deeper soil — farm this plot more first.');
    return true;
  }

  removeJGSeeds(cropId, 1);
  p.crop = cropId;
  p.growthProgress = 0;
  p.wilted = false;
  p.harvestReady = false;

  const tierLabel = getJGSoilTierLabel(p.soilTier);
  const speedPct = Math.round(JG_SOIL_GROW_MULT[p.soilTier] * 100);
  spawnParticles(wx, wy, CROPS[cropId].color, 4, CROPS[cropId].icon);
  showMsg(`${CROPS[cropId].icon} ${CROPS[cropId].name} planted! ${tierLabel.text} — ${speedPct}% grow speed.`);
  player.actionCooldown = 0.32;
  return true;
}