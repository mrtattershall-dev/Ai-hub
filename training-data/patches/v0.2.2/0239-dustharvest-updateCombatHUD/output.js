function updateCombatHUD() {
  const _list = gameState.inBadlands ? badlandsEnemies : enemies;
  const nearby = _list.filter(e => Math.hypot(player.x-e.x, player.y-e.y) < 500);
  const hud = document.getElementById('enemyHud');
  if (nearby.length > 0) {
    hud.classList.add('show');
    document.getElementById('enemyCount').textContent = nearby.length;
  } else {
    hud.classList.remove('show');
  }
}