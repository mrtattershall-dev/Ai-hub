function _tickRuinsGuardSpawns(dt) {
  if (!gameState.inJungle) return;
  if (getDifficultyConfig().enemySpawn === false) return;
  const ptx = Math.floor(player.x / JG_T);
  const pty = Math.floor(player.y / JG_T);
  if (ptx < JG_RUINS_X1 || ptx > JG_RUINS_X2 ||
      pty < JG_RUINS_Y1 || pty > JG_RUINS_Y2) return;

  _ruinsGuardTimer -= dt;
  if (_ruinsGuardTimer > 0) return;
  _ruinsGuardTimer = 20; // faster than normal spawn rate in ruins

  const guardCount = enemies.filter(e => e.type === 'altaverdeGuard').length;
  if (guardCount >= 4) return; // cap

  // Spawn in the ruins zone
  const sx = (JG_RUINS_X1 + 2 + Math.floor(Math.random() * (JG_RUINS_X2 - JG_RUINS_X1 - 4))) * JG_T;
  const sy = (JG_RUINS_Y1 + 2 + Math.floor(Math.random() * (JG_RUINS_Y2 - JG_RUINS_Y1 - 4))) * JG_T;
  if (getJGSolid(Math.floor(sx / JG_T), Math.floor(sy / JG_T))) return;
  spawnEnemy('altaverdeGuard', sx, sy);
  const spawned = enemies[enemies.length - 1];
  if (spawned) { spawned._homeX = sx; spawned._homeY = sy; }
}