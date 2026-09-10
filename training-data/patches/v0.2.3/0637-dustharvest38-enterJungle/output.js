function enterJungle() {
  initJungleZone();

  // Clear other zone flags
  gameState.inOcean     = false;
  gameState.inHoboCamp  = false;
  gameState.inBadlands  = false;
  gameState.inMine      = false;
  gameState.inBLMine    = false;
  gameState.inDeepJungle = false;  // jungle is mutually exclusive with sub-zones
  gameState.inRuins      = false;
  gameState.inJungle    = true;

  // Drop player on dock gangplank
  player.x = 40 * JG_T + JG_T / 2;
  player.y = 15 * JG_T + JG_T / 2;
  player._onBoat = false;
  centerCameraOnPlayer();

  revealAround(player.x, player.y, WORLD_REVEAL_RADIUS + 2, exploredJungle, JG_W, JG_H);
  _onZoneEnter('jungle');

  // Reset arrival sequence if this is the first visit
  if (!jungleTalkSeen.has('kit_arrived_east')) {
    _jungleArrivalStep  = 0;
    _jungleArrivalTimer = 0;
  }

  bgmStop();
  setTimeout(bgmStart, 400);
}