function jgSellItem(itemId, qty) {
  const have = countItem(itemId);
  const sellQty = Math.min(qty, have);
  if (sellQty <= 0) return;
  const price = _getJGExportPrice(itemId);
  const total = price * sellQty;
  removeItem(itemId, sellQty);
  player.gold += total;
  gainRep('jungle', Math.min(3, Math.ceil(total / 200)));
  spawnParticles(player.x, player.y, '#f0d060', 5, `+$${total}`);
  showMsg(`🌿 Sold ${sellQty}× ${ITEMS[itemId]?.name || itemId} for $${total.toLocaleString()} (eastern premium).`);
  dSound('sell');
  _renderTobiasDockPanel();
}