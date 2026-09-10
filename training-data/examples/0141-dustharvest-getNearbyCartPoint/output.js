function getNearbyCartPoint() {
  if (!player._mineCart) return null;
  const fl = gameState.mineFloor;
  if (fl >= 3) return null; // no cart on The Unmapped
  const pts = MINE_CART_POINTS[fl];
  if (!pts) return null;
  if (Math.hypot(player.x - pts.entry.x, player.y - pts.entry.y) < MINE_CART_RADIUS)
    return { dest: pts.deep,  label: 'deep chamber (Floor '+(fl+1)+')' };
  if (Math.hypot(player.x - pts.deep.x,  player.y - pts.deep.y)  < MINE_CART_RADIUS)
    return { dest: pts.entry, label: 'mine entrance (Floor '+(fl+1)+')' };
  return null;
}