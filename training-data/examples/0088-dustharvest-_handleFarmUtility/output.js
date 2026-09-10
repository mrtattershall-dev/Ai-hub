function _handleFarmUtility(tx, ty, wx, wy) {
  // Farm well
  if ((tx===WELL_TX || tx===WELL_TX+1) && ty===WELL_TY) {
    inventory.water = inventory.waterCap;
    spawnParticles(wx, wy, '#4090c0', 6, '💧');
    showMsg('💧 Watering can refilled!'); refreshInvUI(); return true;
  }
  // Farm chest
  if (tx===CHEST_TX && ty===CHEST_TY) {
    if (chestOpen) { closeChest(); } else { openChest(); }
    return true;
  }
  // Sprinkler pickup — E on an existing sprinkler tile retrieves it
  if (getT(tx, ty) === TL.SPRINKLER) {
    setT(tx, ty, TL.DIRT);
    invalidateSprinklerCache();
    addItem('sprinkler', 1);
    spawnParticles(wx, wy, '#60c0e0', 4, '🚿');
    showMsg('🚿 Sprinkler picked up.');
    refreshInvUI(); buildHotbar(); return true;
  }
  return false;
}