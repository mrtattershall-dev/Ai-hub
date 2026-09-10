function updateEnemyGhost(enemy, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++; enemy.vx *= 0.8; enemy.vy *= 0.8;
    enemy.x += enemy.vx; enemy.y += enemy.vy;
    if (enemy.stateTimer >= 12) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.ghost;
  /* Phase flicker — every 120 frames, ghost becomes visible and chaseable */
  enemy.stateTimer++;
  const phase = Math.floor(enemy.stateTimer / 60) % 3;  /* 0=visible, 1=visible, 2=phased */
  enemy.phasing = (phase === 2);

  if (!enemy.phasing && player && player.hp > 0) {
    const dx = (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1));
    const dy = (player.y + (player.h >> 1)) - (enemy.y + (enemy.h >> 1));
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < cfg.aggroRange && dist > 1) {
      enemy.x += (dx / dist) * cfg.speed;
      enemy.y += (dy / dist) * cfg.speed;
      enemy.facing = dx > 0 ? 1 : -1;
    }
  }
  if (++enemy.animTimer >= 8) { enemy.animTimer = 0; enemy.animFrame++; }
}