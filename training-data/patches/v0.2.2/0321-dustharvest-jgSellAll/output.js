function jgSellAll() {
  let total = 0, count = 0;
  for (const id of SELL_ITEMS) {
    const qty = countItem(id);
    if (qty <= 0) continue;
    const price = _getJGExportPrice(id);
    removeItem(id, qty);
    total += price * qty;
    count += qty;
  }
  if (count > 0) {
    player.gold += total;
    gainRep('jungle', Math.min(8, Math.ceil(total / 300)));
    spawnParticles(player.x, player.y, '#f0d060', 8, `+$${total.toLocaleString()}`);
    showMsg(`🌿 Sold ${count} items to Tobias for $${total.toLocaleString()}.`);
    dSound('sell');
    _renderTobiasDockPanel();
  } else {
    showMsg('Nothing to sell.');
  }
}