function isJGFarmTile(tx, ty) {
  if (tx < JG_FARM_X1 || tx > JG_FARM_X2) return false;
  if (ty < JG_FARM_Y1 || ty > JG_FARM_Y2) return false;
  const t = getJGT(tx, ty);
  // Only MUD, DIRT, or already-tilled jungle plots are workable
  return t === JG.MUD || t === JG.DIRT || t === JG.FARM_PLOT;
}