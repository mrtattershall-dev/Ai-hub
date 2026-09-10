function updateEnemies(dt) {
  const px = player.x, py = player.y;
  const safeZone = gameState.zone === 'Farm' || gameState.zone === 'Town' || gameState.zone === 'Ranch';

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e) continue; // array may have been cleared mid-iteration

    // Despawn if player is in safe zone and enemy is far, or if dead
    if (e.hp <= 0) {
      killEnemy(e);
      enemies.splice(i, 1);
      continue;
    }
    const distToPlayer = Math.hypot(px - e.x, py - e.y);
    if (safeZone && distToPlayer > 480) { enemies.splice(i, 1); continue; }

    e.flashTimer = Math.max(0, e.flashTimer - dt);
    e.attackTimer = Math.max(0, e.attackTimer - dt);

    // ── AI per type ──
    if (e.type === 'burrower') {
      if (e.state === 'hiding') {
        e.hideCountdown -= dt;
        if (distToPlayer < 200 || e.hideCountdown <= 0) {
          e.state = 'chase';
          e.hidden = false;
          spawnParticles(e.x, e.y, '#806040', 6, '💨');
        } else continue; // stay underground, don't move
      }
    }

    // Wolf pen-targeting AI (Phase 8)
    if (e.type === 'wolf' && pens.length > 0) {
      // Fix 12: On hard mode wolves target animals first; on normal only when player is not close
      const wolfPlayerThreshold = getDifficultyConfig().spawnMult > 1 ? 60 : 100;
      if (distToPlayer > wolfPlayerThreshold) {
        // Find nearest pen (broken pens still valid — wolf hunts animals inside)
        let nearestPen = null, nearestPenDist = Infinity;
        for (const pen of pens) {
          const pcx = (pen.x + pen.w/2)*T, pcy = (pen.y + pen.h/2)*T;
          const d = Math.hypot(e.x - pcx, e.y - pcy);
          if (d < nearestPenDist) { nearestPenDist = d; nearestPen = pen; }
        }

        if (nearestPen && nearestPenDist < 200) {
          const pcx = (nearestPen.x + nearestPen.w/2)*T;
          const pcy = (nearestPen.y + nearestPen.h/2)*T;

          if (nearestPen.hp > 0) {
            // Phase A: pen intact — attack fence
            e._penTarget = nearestPen.id;
            e._animalTarget = null;
            const angle = Math.atan2(pcy - e.y, pcx - e.x);
            const nx = e.x + Math.cos(angle)*e.def.speed*dt;
            const ny = e.y + Math.sin(angle)*e.def.speed*dt;
            if (!SOLID.has(getT(Math.floor(nx/T),Math.floor(ny/T)))) { e.x=nx; e.y=ny; }
            if (nearestPenDist < T*1.5 && e.attackTimer <= 0) {
              // Lanterns reduce wolf attack chance at night
              if (player._hasLanterns && gameState.isNight && Math.random() < 0.4) { e.attackTimer=1.1; continue; }
              nearestPen.hp = Math.max(0, nearestPen.hp - 8);
              e.attackTimer = 1.1;
              spawnParticles(pcx, pcy, '#c04020', 3, '💥');
              if (nearestPen.hp <= 0) {
                showMsg('🐺 A wolf broke through the pen fence!');
                nearestPen.animals.forEach(aid => {
                  const a = getAnimalById(aid);
                  if (a) { a.state = 'panic'; a.panicTimer = 15; }
                });
              }
            }
            continue;

          } else {
            // Phase B: pen broken — wolf hunts animals inside
            let target = null, targetDist = Infinity;
            for (const aid of nearestPen.animals) {
              const a = getAnimalById(aid);
              if (!a || a.hp <= 0) continue;
              const d = Math.hypot(e.x - a.x, e.y - a.y);
              if (d < targetDist) { targetDist = d; target = a; }
            }

            if (target) {
              e._animalTarget = target.id;
              const angle = Math.atan2(target.y - e.y, target.x - e.x);
              const nx = e.x + Math.cos(angle)*e.def.speed*dt;
              const ny = e.y + Math.sin(angle)*e.def.speed*dt;
              const tileAtNext = getT(Math.floor(nx/T), Math.floor(ny/T));
              if (!SOLID.has(tileAtNext) || tileAtNext === TL.FENCE) { e.x=nx; e.y=ny; }

              if (targetDist < 20 && e.attackTimer <= 0) {
                target.hp -= e.def.damage;
                target.state = 'panic'; target.panicTimer = 8;
                e.attackTimer = e.def.attackCd;
                spawnParticles(target.x, target.y, '#ff4020', 3, '-'+e.def.damage);

                if (target.hp <= 0) {
                  const def = ANIMAL_DEFS[target.type];
                  spawnParticles(target.x, target.y, '#c04020', 6, def.icon);
                  spawnParticles(target.x, target.y, '#806040', 4, '🪶');
                  showMsg(`💀 ${def.name} killed by a wolf! ($${def.buyCost} to replace)`);
                  nearestPen.animals = nearestPen.animals.filter(id => id !== target.id);
                  const idx = animals.indexOf(target);
                  if (idx !== -1) animals.splice(idx, 1);
                  e._animalTarget = null;
                  e._penTarget = null;
                }
              }
              continue;
            }
            // No living animals left in pen — fall through to player chase
          }
        }
      }
      e._penTarget = null;
      e._animalTarget = null;
    }
    // Bandits never attack pens or animals — always chase player
    if (e.type === 'bandit') { /* intentional: fall through to player-chase below */ }

    // Movement toward player (all types that aren't hiding)
    if (!e.hidden) {
      const spd = e.def.speed * (e.type === 'wolf' && distToPlayer < 200 ? 1.5 : 1);
      const angle = Math.atan2(py - e.y, px - e.x);
      const nx = e.x + Math.cos(angle) * spd * dt;
      const ny = e.y + Math.sin(angle) * spd * dt;
      // Basic tile collision for enemies
      if (!SOLID.has(getT(Math.floor(nx/T), Math.floor(ny/T)))) {
        e.x = nx; e.y = ny;
      } else {
        // Try sliding
        const nxa = e.x + Math.cos(angle) * spd * dt;
        if (!SOLID.has(getT(Math.floor(nxa/T), Math.floor(e.y/T)))) e.x = nxa;
        const nya = e.y + Math.sin(angle) * spd * dt;
        if (!SOLID.has(getT(Math.floor(e.x/T), Math.floor(nya/T)))) e.y = nya;
      }
    }

    // Advance walk animation based on movement
    {
      const dx = e.x - (e._prevX || e.x);
      const dy = e.y - (e._prevY || e.y);
      const moved = Math.abs(dx) + Math.abs(dy) > 0.1;
      e._prevX = e.x; e._prevY = e.y;
      if (moved) {
        e.moveAngle = Math.atan2(dy, dx);
        e.facing = dx < 0 ? 'left' : 'right';
        const wSpeed = e.type === 'wolf' ? 0.07 : e.type === 'snake' ? 0.12 : 0.11;
        e.walkTimer += dt;
        if (e.walkTimer > wSpeed) { e.walkFrame = (e.walkFrame + 1) % 4; e.walkTimer = 0; }
      }
    }

    // Attack player if close enough
    if (distToPlayer < e.def.range + 12 && e.attackTimer <= 0 && !e.hidden) {
      damagePlayer(e.def.damage, e.type);
      e.attackTimer = e.def.attackCd;
    }
  }
}