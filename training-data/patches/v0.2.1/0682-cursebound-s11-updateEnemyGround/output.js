function updateEnemyGround(enemy, md, player) {
  const cfg = ENEMY_CFG[enemy.type];

  /* ── Dead flash ── */
  if (enemy.state === 'dead') {
    if (++enemy.stateTimer >= 30) enemy.dead = true;
    return;
  }

  /* ── Hurt — knockback + brief stun ── */
  if (enemy.state === 'hurt') {
    enemy.stateTimer++;
    enemy.vx *= 0.75;
    enemy.vy += PHYS.GRAVITY;
    if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
    const res = resolveCollision(enemy, md);
    enemy.x = res.x; enemy.y = res.y; enemy.vx = res.vx; enemy.vy = res.vy;
    if (enemy.stateTimer >= 14) {
      enemy.state      = enemy.hp <= 0 ? 'dead' : 'patrol';
      enemy.stateTimer = 0;
      if (enemy.state === 'patrol') enemy.vx = 0;
    }
    return;
  }

  const hasPlayer = !!(player && player.hp > 0);
  const pdx       = hasPlayer ? (player.x + (player.w >> 1)) - (enemy.x + (enemy.w >> 1)) : 0;
  const sameFloor = hasPlayer &&
    Math.abs((player.y + player.h) - (enemy.y + enemy.h)) < 40;

  /* ─────────────────────────────────────────────────────────────
     SKELETON: patrol → alert (18fr pause) → attack (22fr lunge)
  ───────────────────────────────────────────────────────────── */
  if (enemy.type === 'skeleton') {
    if (enemy.state === 'patrol') {
      enemy.vx = enemy.facing * cfg.speed;
      if (hasPlayer && sameFloor && Math.abs(pdx) < cfg.aggroRange) {
        enemy.facing     = pdx > 0 ? 1 : -1;
        enemy.state      = 'alert';
        enemy.stateTimer = 0;
        enemy.vx = 0;
      }
    } else if (enemy.state === 'alert') {
      enemy.stateTimer++;
      enemy.vx = 0;
      if (hasPlayer) enemy.facing = pdx > 0 ? 1 : -1;
      if (enemy.stateTimer >= 18) {
        enemy.state      = 'attack';
        enemy.stateTimer = 0;
        enemy.vx         = enemy.facing * cfg.lungeVx;
      }
    } else if (enemy.state === 'attack') {
      /* Decelerate lunge over the 22 frames rather than running full speed */
      enemy.vx *= 0.93;
      if (++enemy.stateTimer >= 22) {
        enemy.state      = 'patrol';
        enemy.stateTimer = 0;
        enemy.vx = 0;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     ARMORED GUARD: patrol → chase (continuous pursuit, 150fr max)
     No lunge. Slow, heavy, persistent.
  ───────────────────────────────────────────────────────────── */
  if (enemy.type === 'armored_guard') {
    if (enemy.state === 'patrol') {
      enemy.vx = enemy.facing * cfg.speed;
      if (hasPlayer && sameFloor && Math.abs(pdx) < cfg.aggroRange) {
        enemy.facing     = pdx > 0 ? 1 : -1;
        enemy.state      = 'chase';
        enemy.stateTimer = 0;
      }
    } else if (enemy.state === 'chase') {
      enemy.stateTimer++;
      if (hasPlayer) enemy.facing = pdx > 0 ? 1 : -1;
      enemy.vx = enemy.facing * cfg.speed;
      const lostPlayer = !hasPlayer || !sameFloor;
      if (lostPlayer && enemy.stateTimer > 30) {
        enemy.state      = 'patrol';
        enemy.stateTimer = 0;
      }
    }
  }

  /* ── Gravity + collision ── */
  enemy.vy += PHYS.GRAVITY;
  if (enemy.vy > PHYS.MAX_FALL) enemy.vy = PHYS.MAX_FALL;
  const res = resolveCollision(enemy, md);
  enemy.x = res.x; enemy.y = res.y;
  enemy.vx = res.vx; enemy.vy = res.vy;

  /* ── Turn logic — only ONE flip per frame ── */
  const inAttack = enemy.state === 'attack';
  const inChase  = enemy.state === 'chase';

  if (inAttack && (res.hitWallL || res.hitWallR)) {
    /* Lunge cancelled by wall */
    enemy.state      = 'patrol';
    enemy.stateTimer = 0;
    enemy.facing    *= -1;
    enemy.vx = 0;

  } else if (inChase && (res.hitWallL || res.hitWallR)) {
    /* Chase hits wall — turn and keep going */
    enemy.facing *= -1;
    enemy.vx = enemy.facing * cfg.speed;

  } else if (!inAttack && !inChase) {
    /* Patrol: wall, pit, and door checks — only one flip allowed */
    let turned = false;
    if (res.hitWallL || res.hitWallR) {
      enemy.facing *= -1;
      turned = true;
    }
    if (!turned && res.onGround && enemyWouldFall(enemy, enemy.facing, md)) {
      enemy.facing *= -1;
      turned = true;
    }
    if (!turned) {
      const ftx = ((enemy.x + (enemy.facing === 1 ? enemy.w + 1 : -1)) / NES.TILE) | 0;
      const fty = ((enemy.y + enemy.h * 0.5) / NES.TILE) | 0;
      const fid = tileAt(md, ftx, fty);
      if (!tileIsSolid(fid) && TILE_PROPS[fid] && TILE_PROPS[fid].trigger) {
        enemy.facing *= -1;
      }
    }
    /* Only restore patrol speed — alert and other non-moving states keep their own vx */
    if (enemy.state === 'patrol') enemy.vx = enemy.facing * cfg.speed;
  }

  /* ── Walk animation ── */
  if (res.onGround && Math.abs(enemy.vx) > 0.1) {
    if (++enemy.animTimer >= 10) { enemy.animTimer = 0; enemy.animFrame++; }
  }
}