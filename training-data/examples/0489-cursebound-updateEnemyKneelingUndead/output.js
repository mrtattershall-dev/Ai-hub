function updateEnemyKneelingUndead(enemy, md, player) {
  /* State machine: kneeling → rising (30fr) → standing → [patrol/chase] → dead */
  if (enemy.state === 'dead') { if (++enemy.stateTimer >= 30) enemy.dead = true; return; }
  if (enemy.state === 'hurt') {
    enemy.stateTimer++;
    enemy.vx *= 0.75; enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const r = resolveCollision(enemy, md);
    enemy.x = r.x; enemy.y = r.y; enemy.vx = r.vx; enemy.vy = r.vy;
    if (enemy.stateTimer >= 14) {
      enemy.state = enemy.hp <= 0 ? 'dead' : 'standing'; enemy.stateTimer = 0;
    }
    return;
  }

  const cfg = ENEMY_CFG_ALL.kneeling_undead;

  if (enemy.state === 'kneeling') {
    /* Dormant — tiny hitbox, no movement. Check player proximity. */
    enemy.h = 10;   /* kneeling height */
    if (player && player.hp > 0) {
      const pdx = Math.abs((player.x + (player.w>>1)) - (enemy.x + (enemy.w>>1)));
      const pdy = Math.abs((player.y + (player.h>>1)) - (enemy.y + enemy.h * 0.5));
      if (pdx < cfg.aggroRange && pdy < 48) {
        enemy.state = 'rising'; enemy.stateTimer = 0;
      }
    }
    /* Still apply gravity so it stays on ground */
    enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = 0; enemy.vy = res.vy;
    return;
  }

  if (enemy.state === 'rising') {
    enemy.stateTimer++;
    /* Grow hitbox from 10→20px over riseFrames (shift y up to compensate) */
    const progress  = Math.min(1, enemy.stateTimer / cfg.riseFrames);
    const newH      = 10 + Math.floor(progress * 10);
    enemy.y        -= (newH - enemy.h);   /* keep feet planted */
    enemy.h         = newH;
    enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = 0; enemy.vy = res.vy;
    if (enemy.stateTimer >= cfg.riseFrames) {
      enemy.state = 'standing'; enemy.h = 20; enemy.stateTimer = 0;
    }
    return;
  }

  /* Standing — behaves like a slow skeleton */
  if (enemy.state === 'standing' || enemy.state === 'patrol' || enemy.state === 'chase') {
    const hp  = !!(player && player.hp > 0);
    const pdx = hp ? (player.x + (player.w>>1)) - (enemy.x + (enemy.w>>1)) : 0;
    const sameFloor = hp && Math.abs((player.y + player.h) - (enemy.y + enemy.h)) < 40;

    if (enemy.state === 'standing') {
      enemy.state = 'patrol'; enemy.vx = 0;
    } else if (enemy.state === 'patrol') {
      enemy.vx = enemy.facing * cfg.speed;
      if (hp && sameFloor && Math.abs(pdx) < cfg.aggroRange) {
        enemy.facing = pdx > 0 ? 1 : -1; enemy.state = 'chase';
      }
    } else {
      if (hp) enemy.facing = pdx > 0 ? 1 : -1;
      enemy.vx = enemy.facing * cfg.speed;
      if (!hp || !sameFloor) enemy.state = 'patrol';
    }

    enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
    if (res.hitWallL || res.hitWallR) enemy.facing *= -1;
    if (res.onGround && enemyWouldFall(enemy, enemy.facing, md)) enemy.facing *= -1;
    if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed;
    if (res.onGround && Math.abs(enemy.vx) > 0.1) {
      if (++enemy.animTimer >= 10) { enemy.animTimer = 0; enemy.animFrame++; }
    }
  }
}