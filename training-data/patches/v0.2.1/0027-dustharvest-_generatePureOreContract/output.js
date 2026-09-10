function _generatePureOreContract(day, slotIdx) {
  // Find which pure ore type the player has most of
  const oreIds = ['goldOre','crystal','ironOre','copperOre','silverOre','coal'];
  let bestOre = 'goldOre';
  for (const id of oreIds) {
    const haul = gameState._mineLastHaul?.[id];
    if (haul && haul.pure > 0) { bestOre = id; break; }
  }
  const it = ITEMS[bestOre];
  const basePrice = BASE_PRICES[bestOre] || 50;
  const qty = 3 + Math.floor(Math.random() * 3); // 3-5 pure ore
  const reward = Math.round(basePrice * qty * 2.0); // 2× for pure-only premium
  const bonus  = Math.floor(reward * 0.3);
  return {
    title: `Pure ${it.name} Order`,
    icon:  it.icon + '✨',
    crop:  bestOre,
    qty,
    reward,
    bonus,
    days: 6,
    desc: `A master smith needs ${qty}× pure ${it.name.toLowerCase()}. Pays ×2 base price — but only pure ore will do. Flawed batches rejected.`,
    uid: 'pure_'+bestOre+day+slotIdx,
    deadline: day + 6,
    hasStreakBonus: false,
    accepted: false,
    pureOreRequired: true,  // flag checked at fulfillment
  };
}