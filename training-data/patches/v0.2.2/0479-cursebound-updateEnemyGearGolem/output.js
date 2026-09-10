function updateEnemyGearGolem(enemy, md, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 40) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++; enemy.vx *= 0.75; enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
    if (enemy.stateTimer >= 16) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.gear_golem;
  enemy.spinTimer = (enemy.spinTimer || 0) + 1;
  const hasPlayer = !!(player && player.hp > 0);
  const pdx = hasPlayer ? (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1)) : 0;
  const sameFloor = hasPlayer && Math.abs((player.y + player.h) - (enemy.y + enemy.h)) < 50;

  if (enemy.state === 'patrol') {
    enemy.vx = enemy.facing * cfg.speed;
    if (hasPlayer && sameFloor && Math.abs(pdx) < cfg.aggroRange) {
      enemy.facing = pdx > 0 ? 1 : -1; enemy.state = 'chase'; enemy.stateTimer = 0;
    }
  } else if (enemy.state === 'chase') {
    if (hasPlayer) enemy.facing = pdx > 0 ? 1 : -1;
    enemy.vx = enemy.facing * cfg.speed;
    if (!hasPlayer || !sameFloor) enemy.state = 'patrol';
  }

  enemy.vy += PHYS.GRAVITY;
  if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
  const res = resolveCollision(enemy, md);
  enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
  if (res.hitWallL || res.hitWallR) enemy.facing *= -1;
  if (res.onGround && enemyWouldFall(enemy, enemy.facing, md)) enemy.facing *= -1;
  if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed;
  if (res.onGround && Math.abs(enemy.vx) > 0.1) {
    if (++enemy.animTimer >= 12) { enemy.animTimer = 0; enemy.animFrame++; }
  }
}