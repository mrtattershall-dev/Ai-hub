function sellItem(itemId, qty) {
  const have = countItem(itemId);
  const sellQty = qty || have;
  if (have < sellQty) { showMsg('Not enough in inventory.'); return; }
  const basePrice = economy.prices[itemId] || BASE_PRICES[itemId] || (ITEMS[itemId] && ITEMS[itemId].baseValue) || 1;
  const repMult = getRepSellMult();
  const isOre = ITEMS[itemId] && ITEMS[itemId].type === 'ore';

  // For ores, compute quality-weighted price across all slots being sold
  let effectivePrice = basePrice;
  if (isOre) {
    let totalUnits = 0, weightedPrice = 0;
    const QUAL_MULT = { flawed: 0.7, standard: 1.0, pure: 1.4 };
    const _eff = getEffectiveSlotCount();
    let remaining = sellQty;
    for (let i=0;i<_eff && remaining > 0;i++) {
      const s = inventory.slots[i];
      if (!s || s.itemId !== itemId) continue;
      const take = Math.min(s.qty, remaining);
      const qm = QUAL_MULT[s.quality || 'standard'] || 1.0;
      weightedPrice += take * basePrice * qm;
      totalUnits += take;
      remaining -= take;
    }
    if (totalUnits > 0) effectivePrice = weightedPrice / totalUnits;
  }

  const earned = Math.floor(sellQty * effectivePrice * repMult);

  // Track last haul quality for mine tab display
  if (isOre && gameState.inMine) {
    if (!gameState._mineLastHaul[itemId]) gameState._mineLastHaul[itemId] = {flawed:0,standard:0,pure:0};
    // Count each quality bucket being sold
    let remaining2 = sellQty;
    const _eff2 = getEffectiveSlotCount();
    for (let i=0;i<_eff2 && remaining2>0;i++) {
      const s = inventory.slots[i];
      if (!s || s.itemId !== itemId) continue;
      const take = Math.min(s.qty, remaining2);
      const q = s.quality || 'standard';
      gameState._mineLastHaul[itemId][q] = (gameState._mineLastHaul[itemId][q]||0) + take;
      remaining2 -= take;
    }
  }

  removeItem(itemId, sellQty);
  player.gold += earned;
  trackGoldEarned(earned);
  spawnParticles(player.x, player.y, '#f0d060', 6, '+$'+earned);
  // Rep gain: each sale earns a tiny amount of town rep (capped by tier thresholds)
  gainRep('town', Math.min(2, Math.ceil(earned / 50)));
  const repNote = repMult > 1.0 ? ` (rep ×${repMult.toFixed(2)})` : repMult < 1.0 ? ' (stranger rates)' : '';
  const qualNote = isOre && effectivePrice !== basePrice ? ` [${effectivePrice > basePrice ? '✨ pure' : '🔸 flawed'}]` : '';
  showMsg(`💰 Sold ${sellQty}× ${ITEMS[itemId].icon} ${ITEMS[itemId].name} for $${earned} ($${Math.round(effectivePrice)}/ea)${repNote}${qualNote}`);
  dSound('sell');
  refreshMarketUI();
}