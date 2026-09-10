function blMineAscend() {
  if (gameState.blMineFloor <= 0) { exitBLMine(); return; }
  gameState.blMineFloor--;
  player.x = BL_MINE_SPAWN[gameState.blMineFloor].x;
  player.y = BL_MINE_SPAWN[gameState.blMineFloor].y;
  centerCameraOnPlayer();
  showMsg('⛏ Ascended to Company Level ' + (gameState.blMineFloor+1));
  updateMineHUD();
}