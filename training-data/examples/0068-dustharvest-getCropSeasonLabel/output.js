function getCropSeasonLabel(cropId) {
  const tier = getCropSeasonTier(cropId);
  if (tier === 'best')   return { text:'★ peak season',  color:'#80e060' };
  if (tier === 'slow')   return { text:'⚠ slow season',  color:'#d09020' };
  if (tier === 'banned') return { text:'✘ wrong season', color:'#e05030' };
  return { text:'', color:'' };
}