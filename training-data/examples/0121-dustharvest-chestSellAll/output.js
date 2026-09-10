function chestSellAll() {
  // Sell everything in the chest directly at current market prices
  const repMult = getRepSellMult();
  const QUAL_MULT = { flawed: 0.7, standard: 1.0, pure: 1.4 };
  let total = 0, count = 0;
  for (let i = 0; i < getChestSize(); i++) {
    const s = chestSlots[i];
    if (!s || !s.itemId) continue;
    if (!SELL_ITEMS.includes(s.itemId)) continue;
    const basePrice = economy.prices[s.itemId] || BASE_PRICES[s.itemId] || BL_BASE_PRICES[s.itemId] || 1;
    const qm = QUAL_MULT[s.quality || 'standard'] || 1.0;
    total += Math.floor(s.qty * basePrice * qm * repMult);
    count += s.qty;
    chestSlots[i] = null;
  }
  if (count > 0) {
    player.gold += total;
    trackGoldEarned(total);
    gainRep('town', Math.min(5, Math.ceil(total / 100)));
    spawnParticles(player.x, player.y, '#f0d060', 8, '+$' + total);
    showMsg(`💰 Sold ${count} items from chest for $${total}!`);
    refreshChestUI(); refreshInvUI(); buildHotbar(); refreshMarketUI();
  } else {
    showMsg('Nothing sellable in the chest.');
  }
}