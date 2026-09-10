function exitRuins() {
  // Clear guards that exist in ruins coords before returning to surface
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i]._inRuins) enemies.splice(i, 1);
  }
  gameState.inRuins  = false;
  gameState.inJungle = true;
  player.x = 13 * JG_T + JG_T / 2;
  player.y = 66 * JG_T + JG_T / 2;
}