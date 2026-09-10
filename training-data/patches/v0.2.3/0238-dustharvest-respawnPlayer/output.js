function respawnPlayer() {
  cancelAction(''); // clear any lingering timed action
  player.hp = 50; player.stamina = 100;
  player.x = 17*T+T/2; player.y = 26*T+T/2;
  player.invincibleTimer = 2.0;
  player.attackCooldown = 0;
  player.actionCooldown = 0;
  centerCameraOnPlayer();
  gameState.isNight = false;
  gameState.zone = 'Farm'; // player always respawns at farm
  // Clear ALL zone flags — player always respawns on the overworld farm
  gameState.inMine     = false;
  gameState.mineFloor  = 0;
  gameState._mineDread = 0;
  gameState._mineCoalSessions = 0;
  gameState.inBadlands = false;
  gameState.inHoboCamp = false;
  gameState.inOcean    = false;
  player._onBoat = false;
  gameState.boatVX = 0; gameState.boatVY = 0;
  enemies.length = 0;
  badlandsEnemies.length = 0;
  // Clear all held keys so player doesn't move in a stuck direction
  for (const k in keys) keys[k] = false;
  deathScreenOpen = false;
  const ds = document.getElementById('deathScreen');
  ds.style.display = 'none';
  ds.classList.remove('show','hide');

  // Clamp camera now that canvas size is known
  gameState.camera.x = Math.max(0, Math.min(MAP_W*T - canvas.width/ZOOM,  gameState.camera.x));
  gameState.camera.y = Math.max(0, Math.min(MAP_H*T - canvas.height/ZOOM, gameState.camera.y));

  // Clear night overlay immediately (don't wait for updateHUD to clear it)
  document.getElementById('nightOverlay').style.background = 'none';
  // Force HUD to reflect new HP/stamina immediately (don't wait for next update())
  updateHUD();
  refreshInvUI();
  buildHotbar();
  showMsg('🌅 You wake at the farm. Everything feels fragile.');
}