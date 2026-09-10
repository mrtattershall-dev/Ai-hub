function enterBLMine() {
  gameState.inBadlands = false; // leaving badlands surface to go underground
  gameState.inBLMine = true;
  gameState.blMineFloor = 0;
  player.x = BL_MINE_SPAWN[0].x + 32;
  player.y = BL_MINE_SPAWN[0].y;
  centerCameraOnPlayer();
  showMsg('⛏ The Company Mine. Five levels. Nobody came to get their equipment.');
  updateMineHUD();
}