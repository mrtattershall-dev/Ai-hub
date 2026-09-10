function _handleMinerInteraction() {
  if (gameState.inMine || gameState.inBadlands) return false;
  if (Math.hypot(player.x - MINER_X, player.y - MINER_Y) < MINER_INTERACT_RADIUS) {
    if (minerOverlayOpen) { closeMinerOverlay(); return true; }
    minerTalkNode = 'root';
    openMinerOverlay('root');
    return true;
  }
  return false;
}