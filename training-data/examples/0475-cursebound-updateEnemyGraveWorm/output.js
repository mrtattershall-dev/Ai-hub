function updateEnemyGraveWorm(enemy, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++; enemy.vx *= 0.75; enemy.vy *= 0.85;
    enemy.x += enemy.vx; enemy.y += enemy.vy;
    if (enemy.stateTimer >= 12) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.grave_worm;
  /* Sine-bob vertical pattern */
  enemy.y = enemy.baseY + Math.sin(G.frame * 0.04 + (enemy.baseX * 0.1)) * 18;
  /* Chase player horizontally when in range */
  if (player && player.hp > 0) {
    const pdx = (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1));
    if (Math.abs(pdx) < cfg.aggroRange) {
      enemy.x += Math.sign(pdx) * cfg.speed;
      enemy.facing = pdx > 0 ? 1 : -1;
    }
  }
  if (++enemy.animTimer >= 10) { enemy.animTimer = 0; enemy.animFrame++; }
}