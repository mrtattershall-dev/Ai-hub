function spawnNightEnemies(dt) {
  if (!gameState.isNight) { nightSpawnTimer = 0; return; }
  if (gameState.inBadlands) return; // badlands has its own spawn system
  if (gameState.inMine)     return; // mine has no night spawns
  if (getDifficultyConfig().enemySpawn === false) return;  // peaceful mode
  if (enemies.length >= MAX_ENEMIES) return;

  nightSpawnTimer -= dt;
  if (nightSpawnTimer > 0) return;

  // Spawn interval shortens as night deepens
  const h = gameState.timeOfDay / 60;
  const nightDepth = h >= 20 ? (h - 20) / 4 : (6 - h) / 6;
  const diffSpawnMult = (getDifficultyConfig().spawnMult || 1) * getCurrentSeason().enemyMult;
  nightSpawnTimer = Math.max(4, (14 - nightDepth * 8) / diffSpawnMult);

  // Pick a random enemy type weighted by spawnWeight
  const pool = [];
  for (const k in ENEMY_DEFS) {
    if (k === 'raider' && gameState.day < 5) continue; // raiders appear day 5+
    if (k === 'raider' && currentSeasonIdx !== 2) continue; // raiders more common in winter
    if (k === 'snake' && gameState.zone === 'Ranch') continue; // no snakes in ranch
    for (let i = 0; i < ENEMY_DEFS[k].spawnWeight; i++) pool.push(k);
  }
  if (pool.length === 0) return;
  const typeKey = pool[Math.floor(Math.random() * pool.length)];

  // ── Ocean zone: two spawn flavors ────────────────────────────────────────
  //   • Pirate skiffs: from deep water (east), approach the dock — night only
  //   • Land enemies: sandy beach only (x < 10 tiles)
  if (gameState.inOcean) {
    const h = gameState.timeOfDay / 60;
    const isDeepNight = h >= 21 || h < 4;

    // Pirate skiffs — spawn chance scales with heat (base 60%, +8% per heat level)
    const pirateChance = Math.min(0.92, 0.60 + (gameState.pirateHeat || 0) * 0.08);
    if (isDeepNight && Math.random() < pirateChance) {
      const spawnX = (OC_W - 4) * OC_T + Math.random() * 3 * OC_T;
      const spawnY = (4 + Math.random() * (OC_H - 8)) * OC_T;
      const skiff = spawnEnemy('pirateSkiff', spawnX, spawnY);
      // Scale hp and damage with heat
      if (skiff && gameState.pirateHeat >= 2) {
        skiff.hp    = Math.round(skiff.hp    * (1 + gameState.pirateHeat * 0.18));
        skiff.maxHp = skiff.hp;
        skiff.dmg   = Math.round((skiff.dmg || 18) * (1 + gameState.pirateHeat * 0.12));
      }
      return;
    }

    // Land enemies — beach only
    const beachMaxX = 9 * OC_T + OC_T / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist  = 380 + Math.random() * 120;
    let ex = Math.max(OC_T / 2, Math.min(beachMaxX, player.x + Math.cos(angle) * dist));
    let ey = Math.max(OC_T / 2, Math.min((OC_H - 1) * OC_T, player.y + Math.sin(angle) * dist));
    const eTile = getOCT(Math.floor(ex / OC_T), Math.floor(ey / OC_T));
    if (eTile === OC.WATER || eTile === OC.DEEP || eTile === OC.DOCK ||
        eTile === OC.GANGPLANK || eTile === OC.BOAT_DECK || eTile === OC.BOAT_HULL ||
        eTile === OC.POST || eTile === OC.EXIT || eTile === OC.SEAGRASS) return;
    spawnEnemy(typeKey, ex, ey);
    return;
  }

  // ── Hobo camp zone: land only, never in the creek (water rows 2-3) ──────────
  if (gameState.inHoboCamp) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 380 + Math.random() * 120;
    let ex = Math.max(HC_T / 2, Math.min((HC_W - 1) * HC_T, player.x + Math.cos(angle) * dist));
    let ey = Math.max(HC_T / 2, Math.min((HC_H - 1) * HC_T, player.y + Math.sin(angle) * dist));
    const eTile = getHCT(Math.floor(ex / HC_T), Math.floor(ey / HC_T));
    if (eTile === TL.WATER || eTile === TL.WALL) return;
    spawnEnemy(typeKey, ex, ey);
    return;
  }

  // ── Default overworld: off-screen, wilderness only (y > 36*T) ────────────────
  const angle = Math.random() * Math.PI * 2;
  const dist  = 380 + Math.random() * 120;
  const sx = Math.max(0, Math.min((MAP_W-1)*T, player.x + Math.cos(angle)*dist));
  const sy = Math.max(36*T, Math.min((MAP_H-1)*T, player.y + Math.sin(angle)*dist));
  spawnEnemy(typeKey, sx, sy);
}