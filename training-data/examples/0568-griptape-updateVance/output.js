function updateVance(dt) {
  if (!vance.active) return;

  const g = vance.group;
  const px = player.pos.x, pz = player.pos.z;
  const vx = g.position.x, vz = g.position.z;
  const dx = px - vx, dz = pz - vz;
  const distToPlayer = Math.sqrt(dx*dx + dz*dz);

  // ── Detection — wide cone (90deg), long range (12 units) ──
  const facingAngle = g.rotation.y;
  _vv1.set(dx, 0, dz);
  const distN = _vv1.length();
  _vv2.set(Math.sin(facingAngle), 0, Math.cos(facingAngle));
  const dot = distN > 0 ? _vv1.normalize().dot(_vv2) : 0;
  const inCone  = dot > 0.5 && distN < 12; // 90deg FOV
  const inClose = distN < 3.0;             // too close regardless
  const hspd = Math.sqrt(player.vel.x**2 + player.vel.z**2);

  if ((inCone || inClose) && hspd > 0.3) {
    vance.alertLevel = Math.min(1, vance.alertLevel + dt * 1.8); // locks on faster than guards
  } else {
    vance.alertLevel = Math.max(0, vance.alertLevel - dt * 0.4);
  }

  // Cone visual
  vance.coneMat.opacity = vance.alertLevel * 0.3;
  vance.coneMat.color.setHex(vance.alertLevel > 0.5 ? 0xff2200 : 0xff6d00);

  // Detention trigger
  if (vance.alertLevel >= 1.0 && !vance.detentionActive && !player.busted) {
    triggerDetention();
    vance.alertLevel = 0;
    return;
  }

  // ── State machine ──
  let speed = 0;

  if (vance.state === 'idle') {
    // stays near school entrance, rarely moves
    vance.patrolTimer -= dt;
    if (vance.patrolTimer <= 0) {
      vance.patrolTimer = 8 + Math.random() * 6;
      vance.state = 'patrol';
      vanceWPIdx = Math.floor(Math.random() * vanceWaypoints.length);
      vance.patrolTarget.copy(vanceWaypoints[vanceWPIdx]);
    }
    speed = 0;

  } else if (vance.state === 'patrol') {
    // Walk between waypoints
    const tx = vance.patrolTarget.x - vx, tz = vance.patrolTarget.z - vz;
    const td = Math.sqrt(tx*tx + tz*tz);
    if (td < 0.8) {
      vanceWPIdx = (vanceWPIdx + 1) % vanceWaypoints.length;
      vance.patrolTarget.copy(vanceWaypoints[vanceWPIdx]);
      if (Math.random() < 0.3) { vance.state = 'idle'; vance.patrolTimer = 4 + Math.random() * 4; }
    } else {
      g.position.x += (tx/td) * 2.5 * dt;
      g.position.z += (tz/td) * 2.5 * dt;
      g.rotation.y = Math.atan2(tx, tz);
      speed = 2.5;
    }
    // Switch to chase if alert is high
    if (vance.alertLevel > 0.4) vance.state = 'chase';

  } else if (vance.state === 'chase') {
    // Sprint directly at player — faster than guards
    if (distToPlayer > 0.5) {
      const chaseSpeed = 4.5 + (vance.alertLevel * 1.5); // speeds up as alert fills
      g.position.x += (dx/distToPlayer) * chaseSpeed * dt;
      g.position.z += (dz/distToPlayer) * chaseSpeed * dt;
      g.rotation.y = Math.atan2(dx, dz);
      speed = chaseSpeed;
    }
    // Give up chase if player gets far and alert drops
    if (vance.alertLevel < 0.1 && distToPlayer > 15) {
      vance.state = 'returning';
    }

  } else if (vance.state === 'returning') {
    // Walk back to school entrance
    const home = vanceWaypoints[5]; // near school
    const hx = home.x - vx, hz = home.z - vz;
    const hd = Math.sqrt(hx*hx + hz*hz);
    if (hd < 1.0) {
      vance.state = 'idle';
      vance.patrolTimer = 5;
    } else {
      g.position.x += (hx/hd) * 2.0 * dt;
      g.position.z += (hz/hd) * 2.0 * dt;
      g.rotation.y = Math.atan2(hx, hz);
      speed = 2.0;
    }
  }

  // ── Walk animation — legs alternate ──
  vance.legPhase += speed * dt * 3;
  const legSwing = Math.sin(vance.legPhase) * 0.25;
  // Legs are children indices 9 and 10 in vanceGroup (0-indexed from push order)
  // Find them by position
  vance.group.children.forEach((c, i) => {
    if (c.geometry && c.geometry.type === 'BoxGeometry') {
      const p = c.position;
      if (Math.abs(p.y - 0.52) < 0.05 && Math.abs(Math.abs(p.x) - 0.10) < 0.02) {
        c.rotation.x = p.x < 0 ? legSwing : -legSwing;
      }
    }
  });

  // ── HUD alert ──
  const isChasing = vance.state === 'chase' && vance.alertLevel > 0.3;
  elVanceHudAlert.style.opacity = isChasing ? '1' : '0';
}