function _handleBadlandsEntry() {
  if (gameState.inBadlands) {
    // Check Badlands-specific interactions first
    if (_handleBadlandsInteract()) return true;
    // In badlands — check for exit portal (right edge marker)
    for (const [cx,cy] of playerAdjacentTiles()) {
      if (getBLT(cx,cy) === BL.BL_EXIT) { exitBadlands(); return true; }
    }
    return false;
  }
  for (const [cx,cy] of playerAdjacentTiles()) {
    if (getT(cx,cy) === TL.BADLANDS_PORTAL) { enterBadlands(); return true; }
  }
  return false;
}