function updateChloe(dt) {
  if (!chloe.active) return;

  const g = chloe.group;
  chloe.stateTimer -= dt;
  chloe.postTimer  -= dt;

  // ── Auto-post: Chloe posts on a timer regardless of skill ──
  if (chloe.postTimer <= 0) {
    chloe.postTimer = 18 + Math.random() * 22; // every 18-40s
    const gain = 80 + Math.floor(Math.random() * 120); // 80-200 followers per post
    chloe.followers += gain;

    const postType = chloePostTypes[Math.floor(Math.random() * chloePostTypes.length)];
    const comment  = chloeComments[Math.floor(Math.random()  * chloeComments.length)];

    // Push to SkateGram feed as Chloe post
    const post = document.createElement('div');
    post.className = 'sg-post new';
    post.textContent = '❤ CHLOE: ' + postType + ' — "' + comment + '"';
    post.style.color = '#f06292';
    sgFeed.prepend(post);
    if (sgFeed.children.length > 6) sgFeed.lastChild.remove();

    updateChloeHud();
  }

  // ── State machine ──
  if (chloe.state === 'skating') {
    // Move toward current spot
    const target = chloeSpots[chloeSpotIdx];
    _cv1.set(target.x - g.position.x, 0, target.z - g.position.z);
    const dist = _cv1.length();

    if (dist < 1.2) {
      // Arrived — switch to filming or posing
      chloe.state = Math.random() < 0.6 ? 'filming' : 'posing';
      chloe.stateTimer = 6 + Math.random() * 10;
      chloe.spotDwellTime = 0;
    } else {
      const spd = 3.0;
      g.position.x += (_cv1.x / dist) * spd * dt;
      g.position.z += (_cv1.z / dist) * spd * dt;
      g.rotation.y = Math.atan2(_cv1.x, _cv1.z);
      // Board wobble while skating
      chloe.legPhase += spd * dt * 2.5;
      chloe.board.rotation.z = Math.sin(chloe.legPhase) * 0.06;
    }

  } else if (chloe.state === 'filming') {
    // Hold phone up, face player occasionally
    const toPlayer = player.pos.x - g.position.x;
    const toPlayerZ = player.pos.z - g.position.z;
    // Slowly rotate toward player
    const targetAngle = Math.atan2(toPlayer, toPlayerZ);
    const da = targetAngle - g.rotation.y;
    g.rotation.y += da * dt * 0.8;

    // Phone glow pulses
    const pulse = 0.4 + Math.sin(Date.now() * 0.004) * 0.3;
    chloe.group.children.forEach(c => {
      if (c.material && c.material.emissiveIntensity !== undefined &&
          c.material.color && c.material.color.r > 0.8) {
        c.material.emissiveIntensity = pulse;
      }
    });

    if (chloe.stateTimer <= 0) {
      chloe.state = 'skating';
      chloeSpotIdx = (chloeSpotIdx + 1) % chloeSpots.length;
    }

  } else if (chloe.state === 'posing') {
    // Stand still, subtle sway
    g.rotation.y += Math.sin(Date.now() * 0.001) * dt * 0.5;
    chloe.board.rotation.z = Math.sin(Date.now() * 0.002) * 0.04;

    if (chloe.stateTimer <= 0) {
      chloe.state = 'skating';
      chloeSpotIdx = Math.floor(Math.random() * chloeSpots.length);
    }
  }

  // ── Nearby detection — show alert if Chloe is close ──
  const cdx = player.pos.x - g.position.x;
  const cdz = player.pos.z - g.position.z;
  const cDist = Math.sqrt(cdx*cdx + cdz*cdz);
  elChloeNearby.style.opacity = cDist < 6 ? '1' : '0';

  // ── HUD throttle ──
  chloeHudTimer += dt;
  if (chloeHudTimer > 0.5) { chloeHudTimer = 0; updateChloeHud(); }
}