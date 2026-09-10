function _handleMineInteraction() {
  if (!gameState.inMine) return false;
  const fl = gameState.mineFloor;
  for (const [cx,cy] of playerAdjacentTiles()) {
    const mt = getMineT(fl, cx, cy);
    if (mt === TL.MINE_EXIT)        { exitMine();    return true; }
    if (mt === TL.MINE_SHAFT_DOWN)  { mineDescend(); return true; }
    if (mt === TL.MINE_SHAFT_UP)    { mineAscend();  return true; }
  }
  const mineNearby = getMineNearbyNode();
  if (mineNearby) { gatherMineNode(mineNearby.key); player.actionCooldown = 0.5; }
  return true; // always consume the action inside the mine
}