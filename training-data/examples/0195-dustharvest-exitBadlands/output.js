function exitBadlands() {
  gameState.inBadlands=false;
  badlandsEnemies.length=0;
  resetHeat();
  closeBLBountyBoard();
  closeBLVendor();
  // Return to left edge of main map, preserve Y, preserve Y
  player.x=3*T;
  player.y=Math.max(2*T, Math.min((MAP_H-3)*T, player.y));
  unstickPlayer();
  centerCameraOnPlayer();
  showMsg('🌵 Back on the frontier. You made it out.');
}