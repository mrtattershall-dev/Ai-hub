function merchantBuy(idx) {
  const item = MERCHANT_STOCK[idx];
  if (!item) return;
  if (!item.isTrade && player.gold < item.cost) { showMsg('⚠️ Not enough gold!'); return; }
  if (!item.isTrade) player.gold -= item.cost;
  item.action();
  refreshInvUI(); buildHotbar();
  openMerchantShop(); // refresh
}