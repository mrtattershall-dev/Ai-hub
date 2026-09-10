function _generateJGContract(day, slotIdx) {
  const rng = _jgRand(day * 113 + slotIdx * 71 + 29);
  const week = getJGWeekNumber(day) || 1;

  // Pool: crop items early, add loot as player progresses
  const allItems = [];
  for (const [cat, ids] of Object.entries(JG_CONTRACT_ITEMS)) {
    for (const id of ids) {
      if (!ITEMS[id]) continue;
      // Loot items only appear after week 3
      if (cat === 'jgLoot' && week < 3) continue;
      // High-value loot (serpentVenom) only after week 6
      if (id === 'serpentVenom' && week < 6) continue;
      allItems.push({ id, cat });
    }
  }
  if (!allItems.length) allItems.push({ id: 'heartleaf', cat: 'jgCrop' });

  const pick = allItems[Math.floor(rng() * allItems.length)];
  const base = BASE_PRICES[pick.id] || 40;

  // Qty: small — these are settlement requests, not bulk industrial orders
  const maxQty = base < 30 ? 8 : base < 80 ? 5 : base < 150 ? 3 : 2;
  const qty    = Math.max(1, Math.round(1 + rng() * (maxQty - 1)));

  // Reward: export price × qty × 1.3 premium (better than raw sell, not as good as perfect timing)
  const exportBase = _getJGExportPrice(pick.id);
  const reward     = Math.round(exportBase * qty * (1.25 + rng() * 0.2));
  const bonus      = Math.floor(reward * 0.35);
  const days       = Math.max(4, Math.round(4 + (qty / maxQty) * 6));

  const buyer = JG_CONTRACT_BUYERS[Math.floor(rng() * JG_CONTRACT_BUYERS.length)];
  const item  = ITEMS[pick.id];
  const desc  = `${buyer.who} needs ${qty > 1 ? qty + '× ' : ''}${item.name.toLowerCase()} ${buyer.wants}. Pays eastern premium + bonus for on-time delivery.`;

  const titleTemplates = [
    `${item.name} Request`, `${item.name} Delivery`, `Settlement ${item.name} Order`,
  ];
  const title = titleTemplates[Math.floor(rng() * titleTemplates.length)];

  return {
    title, icon: item.icon,
    crop: pick.id, qty, reward, bonus, days, desc,
    uid: 'jg_' + pick.id + day + slotIdx,
    deadline: day + days,
    accepted: false,
    isJungle: true,
  };
}