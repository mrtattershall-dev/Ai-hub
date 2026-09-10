function applyWorldState(msg) {
  // world_state is the host's authoritative view, sent every 2s.
  // STRUCTURAL fields (tilled/watered/crop) are only trusted if the plot
  // doesn't already exist locally — avoids un-harvesting a plot that a
  // player just cleared 80ms ago and whose plot_patch hasn't reached host yet.
  // GROWTH fields (harvestReady/wilted/growthProgress/stage/wateredToday)
  // are always synced because only the host advances crop growth timers.
  if (msg.plots) {
    for (const [k, v] of Object.entries(msg.plots)) {
      const exists = !!plots[k];
      if (!plots[k]) plots[k] = {};
      const p = plots[k];
      if (!exists) {
        // New plot we didn't know about — take everything from host
        Object.assign(p, v);
        const [tx,ty] = k.split(',').map(Number);
        if (!isNaN(tx)) {
          try {
            const tile = p.watered ? TL.FARM_WATERED : p.tilled ? TL.FARM_TILLED : TL.DIRT;
            setT(tx, ty, tile);
          } catch(_){}
        }
      } else {
        // Existing plot — only sync growth/time fields, never structural ones
        // This prevents world_state from undoing a harvest that just happened
        if (v.harvestReady !== undefined) p.harvestReady = v.harvestReady;
        if (v.wilted       !== undefined) p.wilted       = v.wilted;
        if (v.growTimer    !== undefined) p.growTimer    = v.growTimer;
        if (v.stage        !== undefined) p.stage        = v.stage;
        if (v.wateredToday !== undefined) p.wateredToday = v.wateredToday;
      }
    }
    // Remove plots host no longer has (structural delete is always authoritative)
    for (const k of Object.keys(plots)) {
      if (!msg.plots[k]) {
        delete plots[k];
        const [tx,ty] = k.split(',').map(Number);
        if (!isNaN(tx)) try { setT(tx,ty,TL.DIRT); } catch(_){}
      }
    }
  }
  try { Object.assign(economy.prices,     msg.econPrices     || {}); } catch(_){}
  try { Object.assign(economy.seedPrices, msg.econSeedPrices || {}); } catch(_){}
  try { economy.event = msg.econEvent || null; economy.evDaysLeft = msg.econEvDaysLeft; } catch(_){}
  // Time/season — only apply if significantly behind (don't jitter)
  if (Math.abs((msg.timeOfDay||0) - gameState.timeOfDay) > 5) {
    gameState.timeOfDay = msg.timeOfDay;
  }
  gameState.day    = msg.day;
  gameState.season = msg.season;
  gameState.isNight = msg.isNight;

  // Sprinkler positions — apply from world state (2s reconciler)
  if (Array.isArray(msg.sprinklers)) {
    try {
      const incoming = new Set(msg.sprinklers.map(([x,y])=>`${x},${y}`));
      // Remove sprinklers the host no longer has
      for (let y=0;y<MAP_H;y++) for (let x=0;x<MAP_W;x++) {
        if (getT(x,y)===TL.SPRINKLER && !incoming.has(`${x},${y}`)) {
          setT(x,y,TL.DIRT);
          if (typeof invalidateSprinklerCache==='function') invalidateSprinklerCache();
        }
      }
      // Place sprinklers the host has that we don't
      for (const [x,y] of msg.sprinklers) {
        if (getT(x,y)!==TL.SPRINKLER) {
          setT(x,y,TL.SPRINKLER);
          if (typeof invalidateSprinklerCache==='function') invalidateSprinklerCache();
        }
      }
    } catch(_){}
  }

  try { if (typeof refreshMarketUI==='function' && window.marketOpen) refreshMarketUI(); } catch(_){}
  // Shared farm state (included in initial world_state on join)
  if (msg.chestSlots) applyChestUpdate({ slots: msg.chestSlots });
  if (msg.weeklyBills) applyDebtUpdate({ weeklyBills: msg.weeklyBills, playerDebt: msg.playerDebt });
  if (msg.upgrades) applyUpgradesUpdate({ upgrades: msg.upgrades });

  // Shared progression — host is authoritative, guests mirror
  try {
    if (msg.activeContracts)    { activeContracts.length=0; for(const c of msg.activeContracts) activeContracts.push(c); }
    if (msg.completedContracts) { const done=new Set(msg.completedContracts); completedContracts=completedContracts.filter(c=>done.has(c.uid)); }
    if (msg.activeQuests)       { activeQuests.length=0; for(const q of msg.activeQuests) activeQuests.push(q); }
    if (msg.completedQuests)    { const doneQ=new Set(msg.completedQuests); completedQuests=completedQuests.filter(q=>doneQ.has(q.id)); }
    if (msg.claimableQuests)    { claimableQuests.length=0; for(const id of msg.claimableQuests) claimableQuests.push(id); }
    if (msg.contractStreak !== undefined) contractStreak = msg.contractStreak;
    if (msg.reputation) Object.assign(REPUTATION, msg.reputation);
    if (msg.sharedStats) {
      // Only ratchet up — never let a stale host value reduce a guest's local stat
      for (const [k,v] of Object.entries(msg.sharedStats)) {
        if (v > (stats[k]||0)) stats[k] = v;
      }
    }
    try { if (typeof refreshMarketUI==='function' && window.marketOpen) refreshMarketUI(); } catch(_){}
  } catch(_) {}
}