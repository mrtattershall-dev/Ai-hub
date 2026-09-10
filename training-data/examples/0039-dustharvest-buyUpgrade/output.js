function buyUpgrade(id) {
  const upg = UPGRADES.find(u => u.id === id);
  if (!upg) return;
  if (!upg.repeatable && purchasedUpgrades.has(id)) { showMsg('Already purchased!'); return; }
  if (upg.requires && !purchasedUpgrades.has(upg.requires)) { showMsg(`⚠️ Requires "${(UPGRADES.find(u=>u.id===upg.requires)||{}).name}" first.`); return; }
  if (player.gold < upg.cost) { showMsg(`⚠️ Need $${upg.cost}. You have $${player.gold}.`); return; }
  player.gold -= upg.cost;
  trackGoldSpent(upg.cost);
  purchasedUpgrades.add(id); // for requires-chains; harmless to re-add
  upg.apply();
  spawnParticles(player.x, player.y, '#f0d060', 8, upg.icon);
  dSound('buy');
  refreshMarketUI();
}