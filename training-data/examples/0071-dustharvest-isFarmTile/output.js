function isFarmTile(tx,ty) {
  // Any dirt tile inside the farm fence (x=2..32, y=2..32) is farmable,
  // as long as it's not occupied by a solid structure or placed feature.
  if (tx < 2 || tx > 32 || ty < 2 || ty > 32) return false;
  const t = getT(tx, ty);
  if (SOLID.has(t)) return false;
  if (t === TL.BUILDING || t === TL.ROAD || t === TL.CAMPFIRE) return false;
  return true;
}