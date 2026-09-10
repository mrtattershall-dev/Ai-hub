function spawnBadlandsEnemy(typeKey, wx, wy) {
  const def = BADLANDS_ENEMY_DEFS[typeKey];
  if(!def) return;
  badlandsEnemies.push({
    id: blEnemyIdCounter++, type: typeKey,
    x: wx, y: wy,
    hp: def.hp, maxHp: def.hp,
    flashTimer: 0,
    state: 'idle', attackTimer: 0,
    hideTimer: def.hideTimer||0, _hidePhase: 0,
  });
}