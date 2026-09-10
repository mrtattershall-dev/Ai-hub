function _jgWater(tx, ty, key, wx, wy) {
  if (inventory.water <= 0) { showMsg('⚠️ Can is empty — find a water source in the jungle.'); return true; }
  const p = jgPlots[key];
  if (!p || !p.tilled) { showMsg('⚠️ Till this soil first!'); return true; }
  if (p.wateredToday) { showMsg('Already watered today.'); return true; }
  if (actionTimer.active && actionTimer._nodeKey === key + '_jgwater') return true;
  if (actionTimer.active) cancelAction('');
  actionTimer._nodeKey = key + '_jgwater';

  const cW = getEffectiveCanW();
  startAction('💧 Watering…', getWaterDuration(), () => {
    let watered = 0;
    for (let dx = 0; dx < cW; dx++) {
      if (inventory.water <= 0) break;
      const ttx = tx + dx, k2 = jgPlotKey(ttx, ty);
      const p2 = jgPlots[k2];
      if (!p2 || !p2.tilled || p2.wateredToday) continue;
      p2.watered = p2.wateredToday = true;
      p2.wilted = false;
      inventory.water--;
      watered++;
    }
    if (watered > 0) {
      stats.tilesWatered += watered;
      spawnParticles(wx, wy, '#2080a0', Math.min(watered * 2, 8), '💧');
      showMsg(`💧 Watered ${watered} jungle plot${watered > 1 ? 's' : ''}! (${inventory.water} left)`);
    }
    player.actionCooldown = 0.1;
    refreshInvUI();
    actionTimer._nodeKey = null;
  });
  return true;
}