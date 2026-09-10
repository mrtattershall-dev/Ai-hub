function jgBuyItem(itemId, cost) {
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} — you have $${player.gold}.`); return; }
  if (!ITEMS[itemId]) { showMsg(`⚠️ Unknown item: ${itemId}.`); return; }
  player.gold -= cost;
  addItem(itemId, 1);
  showMsg(`🌿 Bought ${ITEMS[itemId].name} for $${cost} from Tobias.`);
  dSound('buy');
  _renderTobiasDockPanel();
}