function getMineVisibility() {
  if (!gameState.inMine) return 1;
  if (player._mineLantern) return 1;
  const base = MINE_FLOOR_CFG[gameState.mineFloor].visibility;
  if (gameState._candleBurnLeft > 0) return Math.min(1, base + 0.45);
  if (countItem('torch') > 0)        return Math.min(1, base + 0.28);
  return base;
}