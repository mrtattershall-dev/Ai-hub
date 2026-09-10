function updateEnemyCursedPriest(enemy, md, player) {
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++;
    enemy.vx *= 0.75; enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const r = resolveCollision(enemy, md);
    enemy.x = r.x; enemy.y = r.y; enemy.vx = r.vx; enemy.vy = r.vy;
    if (enemy.stateTimer >= 14) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'patrol'; enemy.stateTimer = 0;
    }
    return;
  }
  const cfg = ENEMY_CFG_ALL.cursed_priest;
  if (enemy.shootCooldown > 0) enemy.shootCooldown--;

  const hp = !!(player && player.hp > 0);
  const pdx = hp ? (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1)) : 0;
  const pdy = hp ? (player.y + (player.h >> 1)) - (enemy.y + (enemy.h >> 1)) : 0;
  const dist = hp ? Math.sqrt(pdx*pdx + pdy*pdy) : 999;

  if (enemy.state === 'patrol') {
    enemy.vx = enemy.facing * cfg.speed * 0.3;   /* slow patrol */
    if (hp && dist < cfg.aggroRange) {
      enemy.facing = pdx > 0 ? 1 : -1;
      enemy.state  = 'chase'; enemy.stateTimer = 0;
    }
  } else if (enemy.state === 'chase') {
    enemy.stateTimer++;
    if (hp) enemy.facing = pdx > 0 ? 1 : -1;

    /* Retreat to maintain distance — priests don't melee */
    if (dist < 40 && hp) {
      enemy.vx = -enemy.facing * cfg.retreatSpeed;
    } else {
      enemy.vx = 0;   /* hold position while shooting */
    }

    /* Fire curse bolt */
    if (hp && dist < cfg.shootRange && enemy.shootCooldown <= 0) {
      const speed = 2.8;
      const norm  = Math.sqrt(pdx*pdx + pdy*pdy) || 1;
      enemyProjectiles.push({
        x: enemy.x + enemy.w * 0.5,
        y: enemy.y + enemy.h * 0.4,
        vx: (pdx / norm) * speed,
        vy: (pdy / norm) * speed,
        w: 5, h: 5, life: 60,
        isCurseBolt: true,   /* purple tint in draw */
      });
      enemy.shootCooldown = cfg.shootCooldown;
    }

    if (!hp || dist > cfg.aggroRange + 24) { enemy.state = 'patrol'; }
  }

  enemy.vy += PHYS.GRAVITY;
  if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
  const res = resolveCollision(enemy, md);
  enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
  if (res.hitWallL || res.hitWallR) { enemy.facing *= -1; enemy.vx = 0; }
  if (res.onGround && enemyWouldFall(enemy, enemy.facing, md)) enemy.facing *= -1;
  if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed * 0.3;
  if (res.onGround && Math.abs(enemy.vx) > 0.1) {
    if (++enemy.animTimer >= 12) { enemy.animTimer = 0; enemy.animFrame++; }
  }
}