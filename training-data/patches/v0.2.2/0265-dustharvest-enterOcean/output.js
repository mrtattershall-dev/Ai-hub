function enterOcean() {
  gameState.inOcean = true;
  const exitY = Math.floor(OC_H/2);
  player.x = 3*OC_T + OC_T/2;
  player.y = exitY*OC_T + OC_T/2;
  centerCameraOnPlayer();
  revealAround(player.x, player.y, WORLD_REVEAL_RADIUS+3, exploredOcean, OC_W, OC_H);
  _onZoneEnter('ocean');
  showMsg('⚓ THE DOCK — salt air, weathered planks. Someone is watching the water east.');
}