function updateEnemyClockworkBird(enemy, player) {
  /* Reuse bat AI with slightly different params */
  const cfg = ENEMY_CFG_ALL.clockwork_bird;
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++; enemy.x += enemy.vx; enemy.y += enemy.vy;
    enemy.vx *= 0.8; enemy.vy *= 0.85;
    if (enemy.stateTimer >= 12) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'returning'; enemy.stateTimer = 0;
    }
    return;
  }
  if (enemy.state === 'returning') {
    const dx = enemy.baseX - enemy.x; const dy = enemy.baseY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) { enemy.x = enemy.baseX; enemy.y = enemy.baseY; enemy.state = 'patrol'; }
    else { const spd = Math.min(2.5, dist * 0.07); enemy.x += (dx / dist) * spd; enemy.y += (dy / dist) * spd; enemy.facing = dx >= 0 ? 1 : -1; }
    if (++enemy.animTimer >= 5) { enemy.animTimer = 0; enemy.animFrame++; }
    return;
  }
  if (enemy.state === 'dive') {
    enemy.stateTimer++;
    if (player && player.hp > 0) {
      const targetCX = player.x + (player.w >> 1);
      const selfCX   = enemy.x  + (enemy.w  >> 1);
      enemy.vx += (targetCX - selfCX) * 0.05;
    }
    enemy.vx = Math.max(-4, Math.min(4, enemy.vx));
    enemy.x += enemy.vx; enemy.y += enemy.vy;
    enemy.facing = enemy.vx >= 0 ? 1 : -1;
    if (enemy.y > enemy.baseY + 110 || enemy.stateTimer > 70) {
      enemy.state = 'returning'; enemy.stateTimer = 0; enemy.vx = 0; enemy.vy = 0;
    }
    if (++enemy.animTimer >= 4) { enemy.animTimer = 0; enemy.animFrame++; }
    return;
  }
  const t = G.frame;
  enemy.x = enemy.baseX + Math.sin(t * 0.028 + enemy.animPhase) * cfg.ampX;
  enemy.y = enemy.baseY + Math.sin(t * 0.02  + enemy.animPhase * 1.5) * cfg.ampY;
  enemy.facing = Math.cos(t * 0.028 + enemy.animPhase) >= 0 ? 1 : -1;
  if (player && player.hp > 0) {
    const cx = enemy.x + (enemy.w >> 1); const pcx = player.x + (player.w >> 1);
    const dx = Math.abs(pcx - cx);
    const dy = (player.y + player.h) - (enemy.y + enemy.h);
    if (dx < 44 && dy > 0 && dy < cfg.aggroRange) {
      enemy.state = 'dive'; enemy.stateTimer = 0; enemy.vy = 2.8; enemy.vx = (pcx - cx) * 0.07;
    }
  }
  if (++enemy.animTimer >= 6) { enemy.animTimer = 0; enemy.animFrame++; }
}