function updateEnemyMechConstruct(enemy, md, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++; enemy.vx *= 0.75; enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
    if (enemy.stateTimer >= 14) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.mech_construct;
  if (enemy.shootCooldown > 0) enemy.shootCooldown--;
  const hasPlayer = !!(player && player.hp > 0);
  const pdx = hasPlayer ? (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1)) : 0;
  const sameFloor = hasPlayer &&
    Math.abs((player.y + player.h) - (enemy.y + enemy.h)) < 40;

  if (enemy.state === 'patrol') {
    enemy.vx = enemy.facing * cfg.speed;
    if (hasPlayer && sameFloor && Math.abs(pdx) < cfg.aggroRange) {
      enemy.facing = pdx > 0 ? 1 : -1;
      enemy.state  = 'chase'; enemy.stateTimer = 0;
    }
  } else if (enemy.state === 'chase') {
    enemy.stateTimer++;
    if (hasPlayer) enemy.facing = pdx > 0 ? 1 : -1;
    enemy.vx = enemy.facing * cfg.speed;
    /* Shoot when in range */
    if (hasPlayer && Math.abs(pdx) < cfg.shootRange && enemy.shootCooldown <= 0) {
      enemyProjectiles.push({
        x: enemy.x + (enemy.facing === 1 ? enemy.w : -6),
        y: enemy.y + enemy.h * 0.4,
        vx: enemy.facing * 3.5, vy: 0,
        w: 4, h: 4, life: 60,
      });
      enemy.shootCooldown = cfg.shootCooldown;
      enemy.vx = 0;  /* brief pause on shoot */
    }
    if (!hasPlayer || !sameFloor) enemy.state = 'patrol';
  }

  enemy.vy += PHYS.GRAVITY;
  if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
  const res = resolveCollision(enemy, md);
  enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
  if (res.hitWallL || res.hitWallR) { enemy.facing *= -1; enemy.vx = 0; }
  if (res.onGround && enemyWouldFall(enemy, enemy.facing, md)) enemy.facing *= -1;
  if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed;
  if (res.onGround && Math.abs(enemy.vx) > 0.1) {
    if (++enemy.animTimer >= 10) { enemy.animTimer = 0; enemy.animFrame++; }
  }
}