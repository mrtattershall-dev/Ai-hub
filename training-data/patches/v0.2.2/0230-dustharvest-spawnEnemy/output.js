function spawnEnemy(typeKey, wx, wy) {
  const def = ENEMY_DEFS[typeKey];
  enemies.push({
    id: enemyIdCounter++,
    type: typeKey, def,
    x: wx, y: wy,
    hp: def.hp, maxHp: def.hp,
    attackTimer: 0,
    flashTimer: 0,
    // Animation
    walkTimer: 0, walkFrame: 0,
    facing: 'right',   // last movement direction (left/right for side flip)
    moveAngle: 0,      // radians, updated each frame
    // Burrower-specific
    hidden: typeKey === 'burrower',
    hideCountdown: def.hideTimer || 0,
    state: typeKey === 'burrower' ? 'hiding' : 'chase',
  });
}