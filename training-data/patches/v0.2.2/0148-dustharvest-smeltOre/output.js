function smeltOre(oreId, barId, oreQty, batches) {
  const totalOre = oreQty * batches;
  if (countItem(oreId) < totalOre) { showMsg('⚠️ Not enough ore!'); return; }
  if (player.stamina < 5) { showMsg('⚠️ Too tired to smelt — eat bread first.'); return; }
  removeItem(oreId, totalOre);
  addItem(barId, batches);
  player.stamina = Math.max(0, player.stamina - 5 * batches);
  spawnParticles(player.x, player.y, '#e08030', 6, ITEMS[barId]?.icon||'🔥');
  showMsg(`🔥 Smelted ${batches}× ${ITEMS[barId]?.name}! Sell at market for a premium.`);
  dSound('tool');
  renderSmeltPanel();
  refreshInvUI();
}