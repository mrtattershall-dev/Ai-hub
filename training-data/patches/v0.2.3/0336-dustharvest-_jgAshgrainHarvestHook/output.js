function _jgAshgrainHarvestHook(key, p) {
  // Immediately bump the tier as if the plot had enough harvests
  if (p.soilTier === 'stripped') {
    p.harvestCount = Math.max(p.harvestCount || 0, JG_HARVESTS_TO_RECOVER);
    _advanceJGSoilTier(key, p);
  } else if (p.soilTier === 'recovering') {
    p.harvestCount = Math.max(p.harvestCount || 0, JG_HARVESTS_TO_RECOVER + JG_HARVESTS_TO_RESTORE);
    _advanceJGSoilTier(key, p);
  }
}