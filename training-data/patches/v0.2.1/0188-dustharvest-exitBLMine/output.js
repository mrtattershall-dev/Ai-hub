function exitBLMine() {
  gameState.inBLMine = false;
  gameState.blMineFloor = 0;
  gameState.inBadlands = true; // returning to badlands surface
  // Return to just east of the entrance tile
  player.x = blMineEntranceX * T + T*2;
  player.y = blMineEntranceY * T + T/2;
  centerCameraOnPlayer();
  showMsg('🏜 Back in the badlands.');
}