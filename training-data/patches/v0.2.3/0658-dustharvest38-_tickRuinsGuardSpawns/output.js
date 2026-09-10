function _tickRuinsGuardSpawns(dt) {
  if (!gameState.inRuins) return;  // only fires when player is inside the ruins zone
  if (getDifficultyConfig().enemySpawn === false) return;

  _ruinsGuardTimer -= dt;
  if (_ruinsGuardTimer > 0) return;
  _ruinsGuardTimer = 22;

  const guardCount = enemies.filter(e => e.type === 'altaverdeGuard' && e._inRuins).length;
  if (guardCount >= 3) return;

  // Spawn at a random passable tile in the ruins zone map
  for (let attempt = 0; attempt < 12; attempt++) {
    const tx = 2 + Math.floor(Math.random() * (RU_W - 4));
    const ty = 2 + Math.floor(Math.random() * (RU_H - 4));
    if (getRUSolid(tx, ty)) continue;
    // Don't spawn on top of player
    if (Math.abs(tx - Math.floor(player.x/RU_T)) < 4 &&
        Math.abs(ty - Math.floor(player.y/RU_T)) < 4) continue;
    const sx = tx * RU_T + RU_T / 2;
    const sy = ty * RU_T + RU_T / 2;
    spawnEnemy('altaverdeGuard', sx, sy);
    const spawned = enemies[enemies.length - 1];
    if (spawned) {
      spawned._homeX  = sx;
      spawned._homeY  = sy;
      spawned._inRuins = true;
      spawned._isJungle = true;
    }
    break;
  }
}