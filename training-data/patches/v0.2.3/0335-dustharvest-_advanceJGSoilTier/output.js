function _advanceJGSoilTier(key, p) {
  const effective = (p.harvestCount || 0) + (p.compostUses || 0) * 2;
  const prev = p.soilTier;
  if (p.soilTier === 'stripped' && effective >= JG_HARVESTS_TO_RECOVER) {
    p.soilTier = 'recovering';
    showMsg('🌱 Soil recovering — this plot is healing. Keep farming.');
    gainRep('jungle', 3);
  } else if (p.soilTier === 'recovering' && effective >= JG_HARVESTS_TO_RECOVER + JG_HARVESTS_TO_RESTORE) {
    p.soilTier = 'restored';
    showMsg('✓ Soil fully restored! Native crops can now grow here.');
    gainRep('jungle', 8);
  }
}