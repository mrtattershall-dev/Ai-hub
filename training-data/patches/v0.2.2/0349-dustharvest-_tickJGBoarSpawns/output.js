function _tickJGBoarSpawns(dt) {
  if (!gameState.inJungle) return;
  if (getDifficultyConfig().enemySpawn === false) return; // peaceful mode

  const pty = Math.floor(player.y / JG_T);
  if (pty < JG_ENTRY_DEEP) { _boarSpawnTimer = 0; return; } // not deep enough

  const boarCount = enemies.filter(e => e.type === 'jungleBoar').length;
  if (boarCount >= JG_BOAR_MAX) return;

  _boarSpawnTimer -= dt;
  if (_boarSpawnTimer > 0) return;

  // Spawn a boar at a random position in the deep entry zone, off-screen
  const diffMult = getDifficultyConfig().spawnMult || 1;
  _boarSpawnTimer = (18 - boarCount * 4) / diffMult; // faster when fewer boars present

  const angle = Math.random() * Math.PI * 2;
  const dist  = 280 + Math.random() * 80;
  const sx = Math.max(JG_T * 4, Math.min((JG_W - 4) * JG_T, player.x + Math.cos(angle) * dist));
  const sy = Math.max(JG_ENTRY_DEEP * JG_T, Math.min((JG_H - 2) * JG_T, player.y + Math.sin(angle) * dist));

  // Don't spawn on solid tile
  if (getJGSolid(Math.floor(sx / JG_T), Math.floor(sy / JG_T))) return;

  spawnEnemy('jungleBoar', sx, sy);
}