function exitJungle() {
  gameState.inJungle = false;
  closeJGTalk && closeJGTalk();
  // Return to ocean — player just arrived on a ship from here
  gameState.inOcean = true;
  player.x = 40 * OC_T + OC_T / 2;
  player.y = 12 * OC_T + OC_T / 2;
  player._onBoat = false;
  unstickPlayer();
  centerCameraOnPlayer();
  showMsg('⚓ Back at the dock. The eastern coast behind you.');
  bgmStop();
  setTimeout(bgmStart, 400);
}