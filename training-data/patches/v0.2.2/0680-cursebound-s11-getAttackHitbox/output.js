function getAttackHitbox(player) {
  if (!player || player.attackTimer <= 0) return null;
  const def = getWeaponDef(player);
  const hbx = player.facing === 1
    ? player.x + player.w
    : player.x - def.reach;
  const hby = player.y + (player.h >> 1) + def.yOff;
  return { x: hbx, y: hby, w: def.reach, h: def.arcH };
}