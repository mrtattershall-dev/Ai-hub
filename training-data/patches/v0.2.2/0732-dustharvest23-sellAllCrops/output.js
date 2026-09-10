function sellAllCrops() {
  let total=0, count=0;
  const repMult = getRepSellMult();
  const QUAL_MULT = { flawed: 0.7, standard: 1.0, pure: 1.4 };
  for (const id of SELL_ITEMS) {
    const qty = countItem(id);
    if (qty <= 0) continue;
    const basePrice = economy.prices[id] || BASE_PRICES[id] || BL_BASE_PRICES[id] || 1;
    const isOre = ITEMS[id] && ITEMS[id].type === 'ore';
    let effectivePrice = basePrice;
    if (isOre) {
      // Quality-weighted price — same logic as sellItem so ore quality is respected
      let totalUnits = 0, weightedPrice = 0;
      const _eff = getEffectiveSlotCount();
      let remaining = qty;
      for (let i = 0; i < _eff && remaining > 0; i++) {
        const s = inventory.slots[i];
        if (!s || s.itemId !== id) continue;
        const take = Math.min(s.qty, remaining);
        const qm = QUAL_MULT[s.quality || 'standard'] || 1.0;
        weightedPrice += take * basePrice * qm;
        totalUnits += take;
        remaining -= take;
      }
      if (totalUnits > 0) effectivePrice = weightedPrice / totalUnits;
    }
    total += Math.floor(qty * effectivePrice * repMult);
    count += qty;
    removeItem(id, qty);
  }
  if (count > 0) {
    player.gold += total;
    trackGoldEarned(total); // was missing — gold earned stat not tracked by sell-all
    gainRep('town', Math.min(5, Math.ceil(total / 100)));
    spawnParticles(player.x, player.y, '#f0d060', 8, '+$'+total);
    showMsg(`💰 Sold ${count} items for $${total}!`);
    refreshMarketUI(); refreshInvUI(); buildHotbar();
  } else {
    showMsg('No sellable goods in bag.');
  }
}