function repairPen(pen) {
  const REPAIR_COST_STONE = 15;
  const REPAIR_COST_WOOD  = 15;
  const hasStone = countItem('stone') >= REPAIR_COST_STONE;
  const hasWood  = countItem('wood')  >= REPAIR_COST_WOOD;
  if (!hasStone && !hasWood) {
    showMsg(`⚠️ Need ${REPAIR_COST_STONE} stone or ${REPAIR_COST_WOOD} wood to repair the pen.`);
    return;
  }
  if (hasStone) { removeItem('stone', REPAIR_COST_STONE); }
  else           { removeItem('wood',  REPAIR_COST_WOOD); }
  pen.hp = pen.maxHp;
  rebuildPenTiles(pen);
  spawnParticles((pen.x+pen.w/2)*T, pen.y*T, '#d4b870', 6, '🪵');
  showMsg('🔨 Pen repaired!');
  refreshInvUI();
}