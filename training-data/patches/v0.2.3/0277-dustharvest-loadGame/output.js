function loadGame() {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) { showMsg('No save found.'); return; }
    const d = JSON.parse(raw);

    // Clear transient runtime state before restoring save
    cancelAction('');
    enemies.length = 0;
    nightSpawnTimer = 0;
    products.length = 0;
    if (gameState.inMine) { gameState.inMine = false; gameState.mineFloor = 0; }
    gameState.inBadlands = false; badlandsEnemies.length = 0;
    gameState.inHoboCamp = false;
    gameState.inOcean = false;
    // Safety: zone flags must be mutually exclusive.
    // If inMine is true, no other zone flag should be.
    if (gameState.inMine || gameState.inBLMine) {
      gameState.inBadlands = false;
      gameState.inHoboCamp = false;
      gameState.inOcean = false;
    }
    gameState.stormActive = false; gameState.stormSheltering = false;
    gameState._stormPhase = 'none'; gameState._stormIntensity = 0;
    gameState._stormTimer = 0; gameState._stormPhaseDur = 0; gameState._stormWarnShown = false;
    gameState._shelterTX = 0; gameState._shelterTY = 0;
    updateStormOverlay && updateStormOverlay();
    closePause();
    closeMarket && closeMarket();
    if (invOpen) toggleInventory();

    gameState.day = d.day;
    gameState.timeOfDay = d.timeOfDay;
    gameState.season = d.season || 'Dry Summer';

    Object.assign(player, d.player);
    if (player.hunger    == null) player.hunger    = 80;   // old save compat
    if (player.gender    == null) player.gender    = 'male';
    if (player.skinTone  == null) player.skinTone  = 0;
    if (player.hairStyle == null) player.hairStyle = 0;
    if (player.hairColor == null) player.hairColor = 1;
    if (player.shirtStyle== null) player.shirtStyle= 0;
    if (player.shirtColor== null) player.shirtColor= 0;
    if (player.pantsColor== null) player.pantsColor= 0;
    if (player.hatColor  == null) player.hatColor  = 0;
    if (!player.name)             player.name      = 'Stranger';

    // ── Restore zone state ──────────────────────────────────────────────────
    // If the save was made in the Badlands, put the player back there.
    // Otherwise make sure inBadlands is cleared (handles old saves with no field).
    if (d.inBadlands) {
      gameState.inBadlands = true;
      generateBLBounties();
      blChestLooted = false;
      badlandsEnemies.length = 0;
      blNightSpawnTimer = 3;
    } else {
      gameState.inBadlands = false;
    }

    if (d.inHoboCamp) {
      gameState.inHoboCamp = true;
    } else {
      gameState.inHoboCamp = false;
    }

    if (d.inOcean) {
      gameState.inOcean = true;
    } else {
      gameState.inOcean = false;
    }

    // Restore boat world position (v14+)
    if (d.boatX != null) gameState.boatX = d.boatX;
    if (d.boatY != null) gameState.boatY = d.boatY;
    gameState.boatVX = 0; gameState.boatVY = 0;
    gameState.pirateHeat = d.pirateHeat || 0;

    // ── Unstick player from solid tiles ────────────────────────────────────
    // buildMap() is unseeded — a tile clear when saved may be solid on reload.
    // Also handles corner-traps where the player's centre is clear but all
    // movement directions are blocked by adjacent solids.
    unstickPlayer();

    inventory.slots = d.inventory.slots;
    // Sanitize slots: drop any entry whose item ID is no longer defined
    // (handles future removals gracefully too)
    for (let i = 0; i < inventory.slots.length; i++) {
      const s = inventory.slots[i];
      if (s && s.itemId && !ITEMS[s.itemId]) {
        console.warn('[load] Dropping unknown item in slot', i, s.itemId);
        inventory.slots[i] = null;
      }
    }
    // Merge seeds so old saves gain new seed types defaulting to 0
    inventory.seeds = Object.assign({ carrotSeed:0, cornSeed:0, pumpkinSeed:0, glowrootSeed:0, tomatoSeed:0, dustwheatSeed:0, sunblossomSeed:0, pepperSeed:0, melonSeed:0, potatoSeed:0, lavenderSeed:0, cactusFruitSeed:0, blueberrySeed:0, garlicSeed:0, strawberrySeed:0, onionSeed:0, watermelonSeed:0, rosehipSeed:0, moonshroomSeed:0 }, d.inventory.seeds);
    inventory.water = d.inventory.water;
    inventory.waterCap = d.inventory.waterCap || 10;

    // Restore plots
    for (const k in plots) delete plots[k];
    for (const k in d.plots) plots[k] = d.plots[k];

    // ── SAVE PATCH: fix plots broken by missing REAL_GROW_SECONDS entries ──
    // Crops planted before the fix have NaN growthProgress and can never
    // mature or be replanted. Reset them to a healthy in-progress state.
    // Also clear stale wilted flag on noWater crops (cactusFruit, moonshroom).
    let _patchCount = 0;
    for (const k in plots) {
      const p = plots[k];
      if (!p.tilled || !p.crop) continue;
      const cropDef = CROPS[p.crop];
      if (!cropDef) continue;
      // Fix NaN / undefined growthProgress
      if (typeof p.growthProgress !== 'number' || isNaN(p.growthProgress)) {
        p.growthProgress = 0;
        p.harvestReady   = false;
        p.wilted         = false;
        _patchCount++;
      }
      // Fix noWater crops that got incorrectly wilted
      if (cropDef.noWater && p.wilted) {
        p.wilted = false;
        _patchCount++;
      }
    }
    if (_patchCount > 0) showMsg(`🔧 Save patched: ${_patchCount} plot(s) repaired.`);

    // Re-draw tilled/watered tiles
    for (const k in plots) {
      const p = plots[k];
      const [tx,ty] = k.split(',').map(Number);
      if (p.tilled && p.crop) {
        setT(tx,ty, p.watered ? TL.FARM_WATERED : TL.FARM_TILLED);
      } else if (p.tilled && !p.crop) {
        // Empty tilled plot — treat as dirt (crop was harvested before save)
        p.tilled = false;
        setT(tx,ty, TL.DIRT);
      }
    }
    // Restore sprinkler tiles
    if (d.sprinklers) {
      for (const [sx2, sy2] of d.sprinklers) setT(sx2, sy2, TL.SPRINKLER);
      invalidateSprinklerCache();
    }

    Object.assign(economy, d.economy);
    // ── SAVE PATCH: Recalculate seed prices from BASE_SEED_PRICES so old saves
    //    get the updated pricing regardless of what was stored. Actual market
    //    fluctuation is re-applied immediately by the first stepEconomy() call.
    for (const k in BASE_SEED_PRICES) {
      economy.seedPrices[k] = BASE_SEED_PRICES[k];
    }
    // Patch old saves: add missing price/mult/hist entries for new items
    for (const k of ['tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry','garlic','strawberry','onion','watermelon','rosehip','moonshroom','banditScarf','wolfPelt','burrowerCarapace','raiderBadge','snakeFang','woolBlanket','copperFitting','ironSpike','leatherStrip','plank','rope','cloth','pepperStew','potatoMash','berryJam','lavenderTea','porkRoast','goatCheese','garlicBread','watermelonSlice','rosehipTonic','mushroomSoup','strawberryPreserves','fishStew','saltChowder','crabBisque','grilledGrouper','swordfishSteak','oysterPlate']) {
      if (economy.prices[k] === undefined) economy.prices[k] = BASE_PRICES[k];
      if (economy.mult[k] === undefined) economy.mult[k] = 1;
      if (!economy.hist[k]) economy.hist[k] = [];
    }
    for (const k of ['tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry','garlic','strawberry','onion','watermelon','rosehip','moonshroom']) {
      if (economy.seedPrices[k] === undefined) economy.seedPrices[k] = BASE_SEED_PRICES[k];
    }
    // ── SAVE PATCH v10: Badlands items economy entries ──────────────────────────
    for (const k of Object.keys(BL_BASE_PRICES)) {
      if (economy.prices[k] === undefined) economy.prices[k] = BL_BASE_PRICES[k];
      if (economy.mult[k]   === undefined) economy.mult[k]   = 1;
      if (!economy.hist[k])                economy.hist[k]   = [];
    }
    // ── SAVE PATCH v10: player fields added in v10 ──────────────────────────────
    if (player._harvestCooldownTimer === undefined) player._harvestCooldownTimer = 0;
    if (player._harvestCooldownMax   === undefined) player._harvestCooldownMax   = 0;
    if (player._workbenchUnlocked    === undefined) player._workbenchUnlocked    = purchasedUpgrades.has('workbench');
    if (player._mineForge            === undefined) player._mineForge            = purchasedUpgrades.has('mine_forge');
    if (player._pistolMode           === undefined) player._pistolMode           = false;
    if (player._rodTier              === undefined) player._rodTier              = purchasedUpgrades.has('rod_gold')?4:purchasedUpgrades.has('rod_iron')?3:purchasedUpgrades.has('rod_copper')?2:purchasedUpgrades.has('rod_cane')?1:0;
    if (player._veraDebtReduction    === undefined) player._veraDebtReduction    = false;
    // veraDebtReduction is already baked into saved bill amounts — no adjustment needed on load
    if (player._venoImmune           === undefined) player._venoImmune           = false;
    gameState._altaverdeFired = d.altaverdeFired || {};
    gameState._postEnding     = d.postEnding     || false;
    if (d.goldHistory) { _goldHistory.length=0; d.goldHistory.forEach(v=>_goldHistory.push(v)); }
    // Restore Altaverde price suppression if it was active
    gameState._altaverdePrices = d.altaverdePrices || {};
    if (gameState._altaverdeFired.suppression && !gameState._altaverdeFired.priceNorm) {
      Object.entries(gameState._altaverdePrices).forEach(([id,p]) => { if(economy.prices[id]) economy.prices[id]=p; });
    }
    // Patch animal objects for new fields
    animals.forEach(a => {
      if (a.sick        === undefined) a.sick = false;
      if (a._baby       === undefined) a._baby = false;
      if (a._babyDays   === undefined) a._babyDays = 0;
      if (a._hungryDays === undefined) a._hungryDays = 0;
      if (a._branded    === undefined) a._branded = false;
    });
    pens.forEach(pen => { if (pen._copperTrough === undefined) pen._copperTrough = false; });
    if (stats.babiesBorn === undefined) stats.babiesBorn = 0;
    // ── SAVE PATCH v17: mine upgrade flags — re-derive from purchasedUpgrades
    //    on saves that pre-date explicit flag storage in the player block
    if (player._mineLantern   === undefined) player._mineLantern   = purchasedUpgrades.has('mine_lantern');
    if (player._mineCanary    === undefined) player._mineCanary    = purchasedUpgrades.has('mine_canary');
    if (player._hardhat       === undefined) player._hardhat       = purchasedUpgrades.has('mine_hardhat');
    if (player._mineCart      === undefined) player._mineCart      = purchasedUpgrades.has('mine_cart');
    if (player._pickDiamond   === undefined) player._pickDiamond   = purchasedUpgrades.has('pick_diamond');
    if (player._geologistEye  === undefined) player._geologistEye  = purchasedUpgrades.has('geologist_eye');
    if (player._orePress      === undefined) player._orePress      = purchasedUpgrades.has('ore_press');
    if (player._deepMap       === undefined) player._deepMap       = purchasedUpgrades.has('deep_map');
    // ── SAVE PATCH v10: SELL_ITEMS — ensure all BL items are present ────────────
    for (const k of Object.keys(BL_BASE_PRICES)) {
      if (!SELL_ITEMS.includes(k)) SELL_ITEMS.push(k);
    }
    activeContracts = d.activeContracts || [];
    completedContracts = d.completedContracts || [];
    // Fill any empty contract slots using stable day-seeded generation (no expiry on load)
    while (activeContracts.length < 3) {
      const slotIdx = activeContracts.length + (gameState.day||1) * 3;
      activeContracts.push(generateOneContract(gameState.day||1, slotIdx));
    }
    contractStreak  = d.contractStreak  || 0;
    streakBonus     = d.streakBonus     || false;
    missedContracts = d.missedContracts || 0;
    activeQuests    = d.activeQuests    || [];
    completedQuests = d.completedQuests || [];
    claimableQuests = d.claimableQuests || [];
    if (d.playerHome) { playerHome.furniture = d.playerHome; initPlayerHome(); }
    if (activeQuests.length === 0) initQuests();
    debtPaidLog = d.debtPaidLog || [];
    weeklyBills = d.weeklyBills || [];

    purchasedUpgrades.clear();
    for (const id of (d.purchasedUpgrades||[])) {
      purchasedUpgrades.add(id);
    }

    // Restore ranch state
    if (d.ranch) {
      animals.length = 0; animals.push(...(d.ranch.animals||[]));
      pens.length = 0; pens.push(...(d.ranch.pens||[]));
      troughFill = d.ranch.troughFill !== undefined ? d.ranch.troughFill : 60;
      barnOpen = d.ranch.barnOpen !== undefined ? d.ranch.barnOpen : false;
      animalIdCounter = d.ranch.animalIdCounter !== undefined ? d.ranch.animalIdCounter : animals.length;
      penIdCounter = d.ranch.penIdCounter !== undefined ? d.ranch.penIdCounter : pens.length;
      // Restore barn tile state
      if (barnOpen) { setT(BARN_TX,BARN_TY,TL.BARN_OPEN); setT(BARN_TX+1,BARN_TY,TL.BARN_OPEN); }
      else { setT(BARN_TX,BARN_TY,TL.BARN_CLOSED); setT(BARN_TX+1,BARN_TY,TL.BARN_CLOSED); }
      // Always restore campfire tile (it's a permanent map feature)
      setT(CAMPFIRE_TX,CAMPFIRE_TY,TL.CAMPFIRE);
      // Fix 1: Rebuild pen fence tiles (not saved in tileMap — must be redrawn)
      for (const pen of pens) {
        // Patch old saves that lack per-pen trough
        if (pen.troughFill === undefined || pen.troughFill === null) pen.troughFill = 30;
        rebuildPenTiles(pen);
      }
    }

    if (d.merchant) {
      merchantNextDay = d.merchant.merchantNextDay || 3;
      merchantPresent = false; // always start not present; updateMerchant() will fire on next day
    }

    centerCameraOnPlayer();

    // Restore chest
    if (d.chest) {
      for (let i = 0; i < getChestSize(); i++) chestSlots[i] = d.chest[i] || null;
    }

    // Restore fog of war
    if (d.fog) {
      try {
        const wb = atob(d.fog.world);
        for (let i = 0; i < exploredWorld.length; i++) exploredWorld[i] = wb.charCodeAt(i);
        d.fog.mine.forEach((b64, fi) => {
          if (!exploredMine[fi]) return;
          const mb = atob(b64);
          for (let i = 0; i < exploredMine[fi].length; i++) exploredMine[fi][i] = mb.charCodeAt(i);
        });
        if (d.fog.badlands) {
          const bb = atob(d.fog.badlands);
          for (let i = 0; i < exploredBadlands.length; i++) exploredBadlands[i] = bb.charCodeAt(i);
        }
        if (d.fog.hobo) {
          const hb = atob(d.fog.hobo);
          for (let i = 0; i < exploredHobo.length; i++) exploredHobo[i] = hb.charCodeAt(i);
        }
        if (d.fog.ocean) {
          const ob = atob(d.fog.ocean);
          for (let i = 0; i < exploredOcean.length; i++) exploredOcean[i] = ob.charCodeAt(i);
        }
        if (d.fog.jungle && typeof initJungleZone === 'function') {
          initJungleZone(); // ensure array is sized before we write into it
          try {
            const jb = atob(d.fog.jungle);
            for (let i = 0; i < exploredJungle.length && i < jb.length; i++)
              exploredJungle[i] = jb.charCodeAt(i);
          } catch(e) {}
        }
      } catch(e) { exploredWorld.fill(0); exploredMine.forEach(g => g.fill(0)); exploredBadlands.fill(0); exploredHobo.fill(0); exploredOcean.fill(0); }
    } else {
      // Old save — no fog data, reveal whole map so existing players arent punished
      exploredWorld.fill(1);
      exploredMine.forEach(g => g.fill(1));
    }
    _minimapCacheDirty = true;

    // Restore mine progression and Silas dialogue state
    if (d.deepestMineFloor != null) gameState._deepestMineFloor = d.deepestMineFloor;
    if (d.minerTalkSeen) { minerTalkSeen = new Set(d.minerTalkSeen); }
    // v17 mine expansion
    gameState._mineJournal     = d.mineJournal      || [];
    gameState._mineLastHaul    = d.mineLastHaul     || {};
    gameState._mineCoalSessions= d.mineCoalSessions || 0;
    gameState._deepMapUsed     = d.deepMapUsed      || {};
    gameState._mineDread       = 0;   // always reset dread on load
    // Candle burns out on reload — if the save had one active, let the player know
    if (d.mineJournal && gameState.inMine && (d.candleBurnLeft || 0) > 0) {
      setTimeout(() => showMsg('🕯️ Your candle burned out while you were away.'), 1500);
    }
    gameState._candleBurnLeft  = 0;   // candle burns out on exit
    if (d.blTalkSeen)    { blTalkSeen    = new Set(d.blTalkSeen); }
    if (d.blMineNPCSeen) { _blMineNPCSeen = new Set(d.blMineNPCSeen); }
    if (d.survivorTalkSeen) { _survivorTalkSeen = new Set(d.survivorTalkSeen); }
    if (d.exploredBLMine && exploredBLMine) {
      d.exploredBLMine.forEach((b64, fl) => {
        if (!b64 || !exploredBLMine[fl]) return;
        try {
          const bin = atob(b64);
          for (let i=0;i<bin.length&&i<exploredBLMine[fl].length;i++)
            exploredBLMine[fl][i] = bin.charCodeAt(i);
        } catch(e) {}
      });
    }
    if (d.hcTalkSeen)    { hcTalkSeen    = new Set(d.hcTalkSeen); }
    if (d.ocTalkSeen)    { ocTalkSeen    = new Set(d.ocTalkSeen); }
    // Jungle zone restore
    gameState.inJungle = d.inJungle || false;
    if (gameState.inJungle && typeof initJungleZone === 'function') {
      initJungleZone();
      // Restore Jungle Entry map modifications immediately (before first render)
      if (typeof _buildJungleEntry === 'function' && typeof _jungleMapBuilt !== 'undefined' && _jungleMapBuilt) {
        _buildJungleEntry();
        if (typeof buildJGResourceNodes === 'function') buildJGResourceNodes();
      }
    }
    if (d.jungleTalkSeen && typeof jungleTalkSeen !== 'undefined')
      jungleTalkSeen = new Set(d.jungleTalkSeen);
    if (d.jgWeeklyBills && typeof jgWeeklyBills !== 'undefined')
      { jgWeeklyBills.length = 0; jgWeeklyBills.push(...d.jgWeeklyBills); }
    if (d.jgDebtPaidLog && typeof jgDebtPaidLog !== 'undefined')
      { jgDebtPaidLog.length = 0; jgDebtPaidLog.push(...d.jgDebtPaidLog); }
    if (d.jgDebt !== undefined)      gameState._jgDebt          = d.jgDebt;
    if (d.jgDebtStartDay != null)    gameState._jgDebtStartDay   = d.jgDebtStartDay;
    if (d.jgDebtFree)                gameState._jgDebtFree       = d.jgDebtFree;
    if (d.jgAltaverdeWarned)         gameState._jgAltaverdeWarned= d.jgAltaverdeWarned;
    if (d.craneSellCount != null) _craneSellCount = d.craneSellCount;
    if (d.fhWeeksLeft != null) { _fhWeeksLeft = d.fhWeeksLeft; }
    if (d.reputation) { Object.assign(REPUTATION, d.reputation); }

    // Restore stats — deep merge so new stat keys added in updates default to 0
    if (d.stats) {
      for (const key of Object.keys(stats)) {
        if (d.stats[key] !== undefined) {
          if (typeof stats[key] === 'object' && !Array.isArray(stats[key]) && stats[key] !== null) {
            Object.assign(stats[key], d.stats[key]);
          } else {
            stats[key] = d.stats[key];
          }
        }
      }
      // Ensure journalLog is an array even on old saves
      if (!Array.isArray(stats.journalLog)) stats.journalLog = [];
    }
    // Re-seed the journal snapshot so the NEXT dawn correctly diffs against now
    _journalDaySnapshot = _takeJournalSnapshot();
    // Restore tip state so returning players don't see day-1 tips
    if (d.tipShown) { _tipShown.clear(); for (const t of d.tipShown) _tipShown.add(t); }

    loadSettings();
    hideTitleScreen();
    tickSeason(gameState.day);
    stepEconomy();
    refreshInvUI(); buildHotbar(); updateFarmPanelPrices();
    updateRanchPanel();
    // Show debt clock
    document.getElementById('debtClock').classList.add('show');
    updateDebtClock();
    showMsg(`🌵 Welcome back, ${d.player&&d.player.name?d.player.name:'Stranger'}. Day ${gameState.day}.${(d.version||1) < 19 ? ` (Save updated to v19 ✓)` : ''}`);
    // Restart music fresh — stop any running BGM first so the guard in bgmStart() doesn't bail
    bgmStop();
    setTimeout(bgmStart, 300);
  } catch(e) { showMsg('⚠️ Load failed: ' + e.message); console.error(e); }
}