function generateOneContract(day, slotIdx) {
  const week = getWeekNumber ? getWeekNumber(day) : 1;
  // Each slot gets a stable seed for this day so re-opening the tab is consistent
  const rng  = _cRand(day * 97 + slotIdx * 31 + 7);

  // Tier: low-value items early, high-value unlocked by week
  const maxPrice = 30 + week * 22;  // week 1: ~$52, week 10: ~$250, week 20: ~$470

  // Build eligible item list from all categories
  const eligible = [];
  for (const [cat, ids] of Object.entries(CONTRACT_ITEMS)) {
    for (const id of ids) {
      const base = BASE_PRICES[id];
      if (!base || base > maxPrice) continue;
      if (!ITEMS[id]) continue;  // item not defined in ITEMS (e.g. ocean fish before zone unlock)
      eligible.push({ id, cat, base });
    }
  }
  if (eligible.length === 0) {
    // Fallback — always eligible
    eligible.push({ id:'carrot', cat:'crop', base: BASE_PRICES.carrot });
  }

  const pick = eligible[Math.floor(rng() * eligible.length)];
  const item = ITEMS[pick.id];

  // Qty: target a contract total value around 3–6× base price, scaled by week
  const targetValue = pick.base * (3 + rng() * 3) * (1 + (week - 1) * 0.1);
  const rawQty      = Math.max(1, Math.round(targetValue / pick.base));
  // Cap qty to avoid absurd numbers on cheap items
  const maxQty      = pick.base < 15 ? 20 : pick.base < 50 ? 12 : pick.base < 150 ? 6 : 3;
  const qty         = Math.min(rawQty, maxQty);

  // Reward: pay a premium over raw market value (40–65% markup)
  const markup   = 1.4 + rng() * 0.25;
  const reward   = Math.round(pick.base * qty * markup);
  const bonus    = Math.floor(reward * 0.4);

  // Days: roughly proportional to qty relative to max
  const baseDays = Math.round(3 + (qty / maxQty) * 5);
  const days     = Math.max(3, Math.min(10, baseDays));

  // Flavour text
  const verbs  = CONTRACT_VERBS[pick.cat] || ['needs'];
  const verb   = verbs[Math.floor(rng() * verbs.length)];
  const buyer  = CONTRACT_BUYERS[Math.floor(rng() * CONTRACT_BUYERS.length)];
  const desc   = `${buyer.who} ${verb} ${qty > 1 ? qty + '× ' : ''}${item.name.toLowerCase()} ${buyer.wants}.`;

  // Title: "Item Type Delivery" or category-flavoured
  const titleTemplates = {
    crop:    [`${item.name} Order`, `${item.name} Delivery`, `${item.name} Haul`],
    gather:  [`${item.name} Supply`, `${item.name} Run`, `Bulk ${item.name}`],
    fish:    [`${item.name} Catch`, `Fresh ${item.name}`, `${item.name} Order`],
    combat:  [`${item.name} Bounty`, `${item.name} Collection`, `${item.name} Request`],
    ore:     [`${item.name} Order`, `${item.name} Supply`, `${item.name} Delivery`],
    crafted: [`${item.name} Order`, `${item.name} Batch`, `${item.name} Supply`],
    animal:  [`${item.name} Delivery`, `${item.name} Order`, `Fresh ${item.name}`],
  };
  const titles = titleTemplates[pick.cat] || [`${item.name} Contract`];
  const title  = titles[Math.floor(rng() * titles.length)];

  return {
    title,
    icon:     item.icon,
    crop:     pick.id,
    qty,
    reward,
    bonus,
    days,
    desc,
    uid:      pick.id + day + slotIdx,
    deadline: day + days,
    hasStreakBonus: false,
    accepted: false,
  };
}