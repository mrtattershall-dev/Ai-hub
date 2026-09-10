function exitDeepJungle() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i]._inDeep) enemies.splice(i, 1);
  }
  gameState.inDeepJungle = false;
  gameState.inJungle     = true;
  player.x = 40 * JG_T + JG_T / 2;
  player.y = 72 * JG_T + JG_T / 2;
  showMsg('🌿 You climb back to the jungle entry zone.');
}