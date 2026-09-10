function _handleJGFarmTool(tx, ty) {
  if (!gameState.inJungle) return false;
  if (!isJGFarmTile(tx, ty)) return false;

  const key = jgPlotKey(tx, ty);
  const wx  = tx * JG_T + JG_T / 2;
  const wy  = ty * JG_T + JG_T / 2;

  if (player.tool === 'till') {
    return _jgTill(tx, ty, key, wx, wy);
  } else if (player.tool === 'water') {
    return _jgWater(tx, ty, key, wx, wy);
  } else if (player.tool === 'plant') {
    return _jgPlant(tx, ty, key, wx, wy);
  } else if (player.tool === 'harvest') {
    return _jgHarvest(tx, ty, key, wx, wy);
  }
  return false;
}