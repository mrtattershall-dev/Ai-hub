function _tickJGEnemySpawns(dt) {
  if (!gameState.inJungle) return;
  if (getDifficultyConfig().enemySpawn === false) return;

  const pty = Math.floor(player.y / JG_T);
  const diffMult = getDifficultyConfig().spawnMult || 1;

  for (const [type, yMin, yMax, maxCount, interval] of JG_SPAWN_DEFS) {
    if (pty < yMin) continue; // player not deep enough

    const activeCount = enemies.filter(e => e.type === type).length;
    if (activeCount >= maxCount) continue;

    if (!_jgSpawnTimers[type]) _jgSpawnTimers[type] = interval / diffMult;
    _jgSpawnTimers[type] -= dt;
    if (_jgSpawnTimers[type] > 0) continue;
    _jgSpawnTimers[type] = (interval - activeCount * 4) / diffMult;

    // Spawn off-screen in the valid y band
    const angle = Math.random() * Math.PI * 2;
    const dist  = 290 + Math.random() * 80;
    const sx = Math.max(JG_T * 2, Math.min((JG_W - 2) * JG_T, player.x + Math.cos(angle) * dist));
    const rawY  = player.y + Math.sin(angle) * dist;
    const sy = Math.max(yMin * JG_T, Math.min(yMax * JG_T - JG_T, rawY));

    if (getJGSolid(Math.floor(sx / JG_T), Math.floor(sy / JG_T))) continue;
    spawnEnemy(type, sx, sy);

    // Set home position for patrol types
    const spawned = enemies[enemies.length - 1];
    if (spawned && spawned.type === 'altaverdeGuard') {
      spawned._homeX = sx; spawned._homeY = sy;
    }
  }
}