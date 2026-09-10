function enterBadlands() {
  gameState.inBadlands=true;
  badlandsEnemies.length=0;
  blNightSpawnTimer=3;
  blBountyBoardOpen = false;
  blVendorOpen = false;
  blVendorTab = 'sell';
  blFenceNode = 'root';
  generateBLBounties();
  resetHeat();
  blChestLooted = false;
  blDeepChestLooted = false;
  // Enter on right edge, preserve player Y clamped to badlands bounds
  player.x=(BL_W-3)*T;
  player.y=Math.max(2*T, Math.min((BL_H-3)*T, player.y));
  unstickPlayer();
  gameState.camera.x=player.x-canvas.width/2;
  gameState.camera.y=player.y-canvas.height/2;
  showMsg('🏜 THE BADLANDS — danger and riches. Find the outpost. Walk right or SE portal to escape.');
  revealAround(player.x,player.y,WORLD_REVEAL_RADIUS+2,exploredBadlands,BL_W,BL_H);
  _onZoneEnter('badlands');
  dSound('night');
}