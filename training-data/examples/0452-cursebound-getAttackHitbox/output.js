function getAttackHitbox(player) {
  if (!player || player.attackTimer <= 0) return null;
  const def = getWeaponDef(player);
  /* Projectile-only weapons have no melee hitbox */
  if (def.projectileOnly) return null;
  /* bothDirs weapons (void_scythe): wide centered sweep — hits both sides */
  if (def.bothDirs) {
    return {
      x: player.x + (player.w >> 1) - def.reach,
      y: player.y + (player.h >> 1) + def.yOff,
      w: def.reach * 2,
      h: def.arcH,
    };
  }
  const hbx = player.facing === 1
    ? player.x + player.w
    : player.x - def.reach;
  const hby = player.y + (player.h >> 1) + def.yOff;
  return { x: hbx, y: hby, w: def.reach, h: def.arcH };
}