function blBuyBackRoom(itemId, price) {
  if (player.gold < price) { showMsg('⚠️ Not enough gold.'); return; }
  player.gold -= price;
  trackGoldSpent(price);
  addItem(itemId, 1);
  spawnParticles(player.x, player.y, '#c0a040', 5, ITEMS[itemId]?.icon||'★');
  showMsg('Crane slides it across without ceremony. "Don\'t tell anyone where you got it."');
  refreshInvUI(); buildHotbar();
  openBLVendor();
}