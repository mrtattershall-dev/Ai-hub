function getCropSeasonGrowMult(cropId) {
  const tier = getCropSeasonTier(cropId);
  if (tier === 'best')   return 1.35;
  if (tier === 'ok')     return 1.0;
  if (tier === 'slow')   return 0.35;
  if (tier === 'banned') return 0.10; // planted before season changed — dying but not instant
  return 1.0;
}