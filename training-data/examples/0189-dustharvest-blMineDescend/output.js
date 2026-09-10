function blMineDescend() {
  if (gameState.blMineFloor >= BL_MINE_FLOORS-1) { showMsg('⛏ No deeper shaft here. The rock is solid.'); return; }
  gameState.blMineFloor++;
  player.x = BL_MINE_SPAWN[gameState.blMineFloor].x;
  player.y = BL_MINE_SPAWN[gameState.blMineFloor].y;
  centerCameraOnPlayer();
  gainRep('badlands', 3); // venturing deeper builds badlands rep
  showMsg('⛏ Descended to Company Level ' + (gameState.blMineFloor+1));
  updateMineHUD();
}