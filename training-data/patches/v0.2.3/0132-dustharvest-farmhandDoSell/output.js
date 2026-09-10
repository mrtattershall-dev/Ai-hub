function farmhandDoSell() {
  // Jed takes crops to market: instant sell at current prices minus 8% fee
  const _effSlots2 = getEffectiveSlotCount ? getEffectiveSlotCount() : 30;
  const cropMap = {};
  for (let _si = 0; _si < _effSlots2; _si++) {
    const s = inventory.slots[_si];
    if (s && s.qty > 0 && CROPS[s.itemId]) cropMap[s.itemId] = (cropMap[s.itemId]||0) + s.qty;
  }
  const cropItems = Object.entries(cropMap);
  if (!cropItems.length) { showMsg('⚠️ No crops in bag to sell.'); return; }
  let totalEarned = 0;
  for (const [id, qty] of cropItems) {
    const price = economy.prices[id] || BASE_PRICES[id] || 0;
    totalEarned += price * qty;
    removeItem(id, qty);
  }
  const fee = Math.max(3, Math.round(totalEarned * 0.08));
  const net = totalEarned - fee;
  player.gold += net;
  trackGoldEarned(net); // farmhand sale should appear in stats
  buildHotbar();
  refreshStats();
  showMsg(`🧑‍🌾 Jed sold your harvest! Got $${net} (after $${fee} fee).`);
  refreshFarmhandUI();
}