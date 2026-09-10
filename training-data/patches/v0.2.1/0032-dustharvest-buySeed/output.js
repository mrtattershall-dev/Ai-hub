function buySeed(crop, qty) {
  const cost = economy.seedPrices[crop] * qty;
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} for ${qty} seeds. You have $${player.gold}.`); return; }
  player.gold -= cost;
  trackGoldSpent(cost);
  inventory.seeds[SEED_MAP[crop]] = (inventory.seeds[SEED_MAP[crop]]||0) + qty;
  spawnParticles(player.x, player.y, '#80c040', 5, `+${qty} seeds`);
  showMsg(`Bought ${qty}× ${crop} seeds for $${cost}. Select in farm menu [F]!`);
  refreshMarketUI(); refreshInvUI(); buildHotbar(); updateFarmPanelPrices();
}