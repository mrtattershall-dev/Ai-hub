function spawnProjectile(player) {
  const wdef = getWeaponDef(player);
  if (!wdef.projectile) return;

  if (wdef.arcThrow) {
    /* Holy Axe — arcing throw */
    projectiles.push({
      type:    'axe',
      x:       player.x + (player.facing === 1 ? player.w : -12),
      y:       player.y + wdef.yOff,
      vx:      player.facing * 2.5,
      vy:      -3.5,
      w: 10, h: 10,
      damage:  wdef.damage,
      life:    90,
      owner:   'player',
      swingId: player.swingId,
      rotation: 0,
    });
  } else {
    /* Cursed Dagger — straight shot */
    projectiles.push({
      type:    'dagger',
      x:       player.x + (player.facing === 1 ? player.w : -wdef.reach),
      y:       player.y + player.h * 0.5 + wdef.yOff,
      vx:      player.facing * 4.5,
      vy:      0,
      w:       8, h: 4,
      damage:  wdef.damage,
      life:    40,
      owner:   'player',
      swingId: player.swingId,
    });
  }
}