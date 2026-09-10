function _handleBLMineInteraction() {
  if (!gameState.inBLMine) return false;
  const fl = gameState.blMineFloor;
  for (const [cx,cy] of playerAdjacentTiles()) {
    const mt = getBLMineT(fl, cx, cy);
    if (mt === TL.MINE_EXIT)        { blMineAscend(); return true; }
    if (mt === TL.MINE_SHAFT_UP)    { blMineAscend(); return true; }
    if (mt === TL.MINE_SHAFT_DOWN)  { blMineDescend(); return true; }
  }
  // Check for NPC interaction
  if (_handleBLMineNPCInteraction()) return true;
  // Gather nearby node
  const nearby = getBLMineNearbyNode();
  if (nearby) { gatherBLMineNode(nearby.key); player.actionCooldown = 0.5; }
  return true;
}