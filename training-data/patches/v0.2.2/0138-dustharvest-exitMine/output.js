function exitMine() {
  gameState.inMine = false;
  gameState.mineFloor = 0;
  gameState._mineDread = 0;
  gameState._mineCoalSessions = 0; // streak only persists within a single mine visit
  // Prune _deepMapUsed: drop keys from days more than 3 behind the current day
  // to prevent unbounded save-file growth
  if (gameState._deepMapUsed) {
    const cutoff = gameState.day - 3;
    for (const k of Object.keys(gameState._deepMapUsed)) {
      const dayPart = parseInt(k.split('_')[1], 10);
      if (!isNaN(dayPart) && dayPart < cutoff) delete gameState._deepMapUsed[k];
    }
  }
  // Teleport back to the MINE tile on the overworld (68,58)
  player.x = 68 * T + T/2;
  player.y = 59 * T + T/2;
  unstickPlayer();
  centerCameraOnPlayer();
  showMsg(`🌤 Exited the mine — back on the surface.`);
  appendMineJournal(`Day ${gameState.day} — Left the mine.`);
  updateMineHUD();
}