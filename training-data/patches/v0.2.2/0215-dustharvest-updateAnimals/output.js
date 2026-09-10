function updateAnimals(dt) {
  animals.forEach(a => {
    if (a.hp <= 0) return;
    const pen = getPenById(a.penId);
    const def = ANIMAL_DEFS[a.type];

    a.stateTimer -= dt;
    a.dirTimer -= dt;

    // Night: sleeping
    if (gameState.isNight && a.state !== 'panic') {
      a.state = 'sleeping';
      a.moveX = 0; a.moveY = 0;
      return;
    }

    // Panic countdown
    if (a.state === 'panic') {
      a.panicTimer -= dt;
      if (a.panicTimer <= 0) a.state = 'idle';
    }

    // Pick new wander direction
    if (a.dirTimer <= 0) {
      a.dirTimer = 1.2 + Math.random()*2;
      if (Math.random() < 0.3) { a.moveX = 0; a.moveY = 0; } // pause
      else {
        const ang = Math.random()*Math.PI*2;
        const spd = a.state === 'panic' ? 1.8 : 1;
        a.moveX = Math.cos(ang)*spd; a.moveY = Math.sin(ang)*spd;
      }
    }

    // Move within pen bounds (or barn if open)
    if (a.moveX !== 0 || a.moveY !== 0) {
      const spd = def.speed * (a.state === 'panic' ? 1.8 : 1);
      let nx = a.x + a.moveX * spd * dt;
      let ny = a.y + a.moveY * spd * dt;

      // Constrain to pen
      if (pen) {
        const minX = (pen.x+1)*T, maxX = (pen.x+pen.w-1)*T;
        const minY = (pen.y+1)*T, maxY = (pen.y+pen.h-1)*T;
        nx = Math.max(minX, Math.min(maxX, nx));
        ny = Math.max(minY, Math.min(maxY, ny));
      }
      a.x = nx; a.y = ny;

      a.walkTimer += dt;
      if (a.walkTimer > 0.18) { a.walkFrame = (a.walkFrame+1)%2; a.walkTimer = 0; }
      if (Math.abs(a.moveX) > Math.abs(a.moveY)) a.facing = a.moveX > 0 ? 'right' : 'left';
      else a.facing = a.moveY > 0 ? 'down' : 'up';
    }
  });

  // Enemies near pens trigger animal panic (burrowers when surfaced, wolves/raiders always at night)
  enemies.forEach(e => {
    const isThreat = (e.type === 'burrower' && e.surfaced) ||
                     (gameState.isNight && (e.type === 'wolf' || e.type === 'raider' || e.type === 'bandit'));
    if (!isThreat) return;
    pens.forEach(pen => {
      const penCx = (pen.x + pen.w/2)*T, penCy = (pen.y + pen.h/2)*T;
      if (Math.hypot(e.x - penCx, e.y - penCy) < 3*T) {
        pen.animals.forEach(aid => {
          const a = getAnimalById(aid);
          if (a && a.state !== 'panic') { a.state = 'panic'; a.panicTimer = 12; }
        });
      }
    });
  });

  // Horse ownership speed bonus — passive +20% speed and -30% sprint cost while a live horse is in a pen
  // (replaces the old 'Saddled Horse' upgrade — owning one is now the requirement)
  if (animals.some(a => a.type === 'horse' && a.hp > 0)) {
    player._speedMult = Math.max(player._speedMult || 1, 1.2);
    player._sprintCostMult = Math.min(player._sprintCostMult || 1, 0.7);
  }
}