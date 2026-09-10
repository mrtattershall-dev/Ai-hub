function updateEnemyCrawler(enemy, md, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++;
    enemy.vx *= 0.75; enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
    if (enemy.stateTimer >= 14) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.crawler;
  const pdx = player && player.hp > 0 ?
    (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1)) : 0;

  if (enemy.state === 'patrol') {
    enemy.vx = enemy.facing * cfg.speed;
    if (player && player.hp > 0 && Math.abs(pdx) < cfg.aggroRange) {
      enemy.facing = pdx > 0 ? 1 : -1;
      enemy.state  = 'chase';
    }
  } else if (enemy.state === 'chase') {
    if (player && player.hp > 0) enemy.facing = pdx > 0 ? 1 : -1;
    enemy.vx = enemy.facing * cfg.speed;
    if (!player || Math.abs(pdx) > cfg.aggroRange + 20) enemy.state = 'patrol';
  }

  enemy.vy += PHYS.GRAVITY;
  if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
  const res = resolveCollision(enemy, md);
  enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;

  if (res.hitWallL || res.hitWallR) { enemy.facing *= -1; enemy.vx = 0; }
  if (res.onGround && enemyWouldFall(enemy, enemy.facing, md)) enemy.facing *= -1;
  if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed;

  if (res.onGround && Math.abs(enemy.vx) > 0.1) {
    if (++enemy.animTimer >= 8) { enemy.animTimer = 0; enemy.animFrame++; }
  }
}