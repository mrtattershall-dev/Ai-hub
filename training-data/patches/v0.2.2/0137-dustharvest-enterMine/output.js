function enterMine() {
  if (!isMineOpen()) {
    showMsg(`⛏ Mine is closed at night! Open ${getMineHours()} only — too dangerous after dark.`);
    return;
  }
  gameState.inMine = true;
  gameState.mineFloor = 0;
  gameState._mineDread = 0;
  gameState._candleBurnLeft = 0;
  player.x = MINE_SPAWN[0].x;
  player.y = MINE_SPAWN[0].y;
  centerCameraOnPlayer();
  showMsg(`⛏ Entered the Mine — Floor 1. Mine closes at 8:00 PM!`);
  appendMineJournal(`Day ${gameState.day} — Entered the mine. Floor 1.`);
  updateMineHUD();
}