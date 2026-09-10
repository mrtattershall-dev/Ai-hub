function onNewDay() {
  stats.daysSurvived++;
  if (gameState.isNight) stats.nightsSurvived++; // survived through nighttime to dawn
  gameState._noonProductsDespawned = false;
  _hungerWarnedHungry   = false;
  _hungerWarnedStarving = false;
  // ── 2-day advance season warning ─────────────────────────────────────────
  {
    const totalDays = SEASONS.reduce((s,ss)=>s+ss.days,0);
    const cycleNow  = (gameState.day - 1) % totalDays;
    const cycleSoon = (gameState.day) % totalDays; // what day+1 falls in
    let idxNow = null, idxSoon = null, acc = 0;
    for (let i = 0; i < SEASONS.length; i++) {
      acc += SEASONS[i].days;
      if (idxNow  === null && cycleNow  < acc) idxNow  = i;
      if (idxSoon === null && cycleSoon < acc) idxSoon = i;
    }
    if (idxNow !== null && idxSoon !== null && idxNow !== idxSoon) {
      const coming = SEASONS[idxSoon];
      const bannedNow = (typeof plots !== 'undefined' ? Object.keys(plots) : []).filter(k => {
        const p = plots[k];
        return p && p.crop && !p.harvestReady &&
               (CROP_SEASONS[p.crop]?.[coming.name]) === 'banned';
      }).map(k => CROPS[plots[k].crop]?.name).filter(Boolean);
      const uniqueBanned = [...new Set(bannedNow)];
      let warnMsg = `${coming.icon} ${coming.name} arrives tomorrow. ${coming.changeMsg.split('.')[0]}.`;
      if (uniqueBanned.length) {
        warnMsg += ` ⚠ Harvest your ${uniqueBanned.slice(0,3).join(', ')} — they won't survive the season change.`;
      } else {
        warnMsg += ` Check your fields and stock up.`;
      }
      showMsg(warnMsg);
    }
  }
  tickSeason(gameState.day);
  stepEconomy();
  expireContracts(gameState.day);
  generateContracts(gameState.day);
  checkQuests();
  respawnNodes();
  respawnBadlandsNodes();
  spawnEncounter();
  onNewDayRanch();
  updateMerchant();
  farmhandDawnTick();
  if (_mineEncounterCooldown > 0) _mineEncounterCooldown--;
  enemies.length = 0;
  nightSpawnTimer = 0;
  gameState.pirateHeat = 0; // pirate heat resets each dawn — new night, fresh crew
  showMsg(`🌅 Day ${gameState.day} — dawn breaks, enemies retreat. Water refilled.`);
  if (gameState.day > 1) showDaySummary(gameState.day);
  for (const key in plots) {
    const p = plots[key];
    if (!p.tilled || !p.crop) continue;
    // Wilt check moved to 8am grace period — see gameLoop tick below.
    // At dawn we just clear the watered flags so crops need watering again today.
    p.wateredToday = false;
    p.watered = false;
    const [lx,ly] = key.split(',').map(Number);
    if (p.crop) {
      setT(lx, ly, TL.FARM_TILLED); // keep tilled while a crop is growing
    } else {
      p.tilled = false;
      setT(lx, ly, TL.DIRT); // empty tilled plots revert to dirt overnight
    }
  }
  inventory.water = inventory.waterCap;
  // ── Sprinkler dawn watering ──────────────────────────────────────────────
  // Each TL.SPRINKLER tile waters the 4 adjacent (cardinal) farm plots.
  let sprinklerCount = 0;
  for (let ty2 = 0; ty2 < MAP_H; ty2++) {
    for (let tx2 = 0; tx2 < MAP_W; tx2++) {
      if (getT(tx2, ty2) !== TL.SPRINKLER) continue;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = tx2+dx, ny = ty2+dy;
        const pk = plotKey(nx, ny);
        const p = plots[pk];
        if (p && p.tilled && !p.harvestReady) {
          p.watered = p.wateredToday = true; p.wilted = false;
          setT(nx, ny, TL.FARM_WATERED);
          sprinklerCount++;
        }
      }
    }
  }
  if (sprinklerCount > 0) showMsg(`🚿 Sprinklers fired! ${sprinklerCount} plot${sprinklerCount>1?'s':''} watered.`);
  // ── Spring rain — runs after dawn reset and sprinklers ───────────────────
  // Flags are now fresh (wateredToday=false), so spring rain sets them cleanly.
  if (getCurrentSeason && getCurrentSeason().name === 'Wet Spring') {
    let springWatered = 0;
    for (const key in plots) {
      const p = plots[key];
      if (!p.tilled || !p.crop || p.wateredToday || p.harvestReady) continue;
      if (Math.random() < 0.65) {
        p.watered = p.wateredToday = true; p.wilted = false;
        const [lx, ly] = key.split(',').map(Number);
        setT(lx, ly, TL.FARM_WATERED);
        springWatered++;
      }
    }
    if (springWatered > 0) showMsg(`🌧️ Spring rain watered ${springWatered} plot${springWatered>1?'s':''} overnight.`);
  }
  refreshInvUI();
  checkWeeklyBill();
  updateDebtClock();   // ← keep debt clock fresh each dawn
  dSound('dawn');      // ← dawn fanfare
  if (settings.autoSave) saveGame(true);
}