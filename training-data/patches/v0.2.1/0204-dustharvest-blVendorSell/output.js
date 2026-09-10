function blVendorSell(itemId, qty, priceEach) {
  const have = countItem(itemId);
  if (have <= 0) { showMsg('⚠️ Nothing to sell.'); return; }
  const sellQty = Math.min(qty, have);
  removeItem(itemId, sellQty);
  const earned = sellQty * priceEach;
  player.gold += earned;
  trackGoldEarned(earned);
  _craneSellCount += sellQty;
  gainRep('badlands', Math.ceil(sellQty * 0.5)); // each item sold = 0.5 rep
  // Milestone — trusted trader unlocked
  if (_craneSellCount >= 50 && _craneSellCount - sellQty < 50) {
    setTimeout(() => showMsg(`🤝 Crane watches you count your gold. "You keep coming back." He doesn't say more — but something shifted.`), 1200);
  }
  spawnParticles(player.x, player.y, '#f0d060', 6, '+$'+earned);
  showMsg(`🤝 Sold ${sellQty}× ${ITEMS[itemId]?.name||itemId} for $${earned}.`);
  refreshInvUI(); buildHotbar();
  openBLVendor(); // refresh
}