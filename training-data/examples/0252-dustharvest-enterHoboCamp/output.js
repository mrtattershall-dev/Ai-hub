function enterHoboCamp() {
  gameState.inHoboCamp = true;
  player.x = 29 * HC_T + HC_T/2;
  player.y = (HC_H - 4) * HC_T;
  centerCameraOnPlayer();
  revealAround(player.x, player.y, WORLD_REVEAL_RADIUS+3, exploredHobo, HC_W, HC_H);
  _onZoneEnter('hoboCamp');
  showMsg('🏕 THE HOBO CAMP — people who fell through the cracks. They need things. They know things.');
}