function buyHomeFurniture(id) {
  const def = HOME_FURNITURE[id];
  if (!def) return;
  if (homeFurnitureOwned(id)) { showMsg('Already placed!'); return; }
  if (player.gold < def.cost) { showMsg(`⚠️ Need $${def.cost}.`); return; }
  player.gold -= def.cost;
  trackGoldSpent && trackGoldSpent(def.cost);
  placeHomeFurniture(id);
  dSound('buy');
  spawnParticles(player.x, player.y, '#88cc44', 6, def.icon);
  showMsg(`🏠 ${def.name} placed in your house!`);
  refreshFarmhandUI();
}