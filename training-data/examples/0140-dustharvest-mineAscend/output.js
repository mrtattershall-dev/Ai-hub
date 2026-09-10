function mineAscend() {
  if (gameState.mineFloor <= 0) { exitMine(); return; }
  gameState.mineFloor--;
  player.x = MINE_SPAWN[gameState.mineFloor].x;
  player.y = MINE_SPAWN[gameState.mineFloor].y;
  centerCameraOnPlayer();
  showMsg(`⛏ Ascended to Floor ${gameState.mineFloor+1}`);
  updateMineHUD();
}