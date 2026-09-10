function updateEnemyBat(enemy, player) {
  const cfg = ENEMY_CFG.bat;

  /* ── Dead flash ── */
  if (enemy.state === 'dead') {
    if (++enemy.stateTimer >= 30) enemy.dead = true;
    return;
  }

  /* ── Hurt — knocked away, then return to base ── */
  if (enemy.state === 'hurt') {
    enemy.stateTimer++;
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
    enemy.vx *= 0.80;
    enemy.vy *= 0.85;
    if (enemy.stateTimer >= 14) {
      enemy.state      = enemy.hp <= 0 ? 'dead' : 'returning';
      enemy.stateTimer = 0;
    }
    if (++enemy.animTimer >= 7) { enemy.animTimer = 0; enemy.animFrame++; }
    return;
  }

  /* ── Returning — fly smoothly back to base, then resume patrol ── */
  if (enemy.state === 'returning') {
    const dx   = enemy.baseX - enemy.x;
    const dy   = enemy.baseY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) {
      /* Arrived — snap cleanly and resume sine wave */
      enemy.x     = enemy.baseX;
      enemy.y     = enemy.baseY;
      enemy.state = 'patrol';
    } else {
      /* Proportional speed — faster when far, slows near base */
      const spd = Math.min(2.2, Math.max(0.8, dist * 0.07));
      enemy.x  += (dx / dist) * spd;
      enemy.y  += (dy / dist) * spd;
      enemy.facing = dx >= 0 ? 1 : -1;
    }
    if (++enemy.animTimer >= 7) { enemy.animTimer = 0; enemy.animFrame++; }
    return;
  }

  /* ── Dive — tracks player horizontally while falling ── */
  if (enemy.state === 'dive') {
    enemy.stateTimer++;
    if (player && player.hp > 0) {
      const targetCX = player.x + (player.w >> 1);
      const selfCX   = enemy.x  + (enemy.w  >> 1);
      enemy.vx += (targetCX - selfCX) * 0.04;
    }
    enemy.vx = Math.max(-3, Math.min(3, enemy.vx));
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
    enemy.facing = enemy.vx >= 0 ? 1 : -1;

    /* End dive: overshot base or ran too long */
    if (enemy.y > enemy.baseY + 110 || enemy.stateTimer > 80) {
      enemy.state      = 'returning';
      enemy.stateTimer = 0;
      enemy.vx = 0;
      enemy.vy = 0;
    }
    if (++enemy.animTimer >= 5) { enemy.animTimer = 0; enemy.animFrame++; }
    return;
  }

  /* ── Patrol — sine-wave float ── */
  const t    = G.frame;
  enemy.x    = enemy.baseX + Math.sin(t * 0.025 + enemy.animPhase) * cfg.ampX;
  enemy.y    = enemy.baseY + Math.sin(t * 0.018 + enemy.animPhase * 1.5) * cfg.ampY;
  enemy.facing = Math.cos(t * 0.025 + enemy.animPhase) >= 0 ? 1 : -1;

  /* Dive trigger: player is below within horizontal + vertical range */
  if (player && player.hp > 0) {
    const cx  = enemy.x  + (enemy.w  >> 1);
    const pcx = player.x + (player.w >> 1);
    const dx  = Math.abs(pcx - cx);
    const dy  = (player.y + player.h) - (enemy.y + enemy.h);   /* +ve = player below */
    if (dx < 44 && dy > 0 && dy < cfg.aggroRange) {
      enemy.state      = 'dive';
      enemy.stateTimer = 0;
      enemy.vy = cfg.diveSpeed;
      enemy.vx = (pcx - cx) * 0.06;
    }
  }
  if (++enemy.animTimer >= 7) { enemy.animTimer = 0; enemy.animFrame++; }
}