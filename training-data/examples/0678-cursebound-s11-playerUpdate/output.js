function playerUpdate() {
  const p  = G.player;
  if (!p) return;
  const md = ZONES[G.currentZoneId] && ZONES[G.currentZoneId].mapData;
  if (!md) {
    /* Zone not yet built — immediately return player to entry hall */
    transitionZone(ZONE_ID.ENTRY);
    return;
  }

  /* ── Timers ── */
  if (p.iFrames     > 0) p.iFrames--;
  if (p.attackTimer > 0) p.attackTimer--;
  if (p.kbTimer     > 0) p.kbTimer--;
  if (p.notifyTimer > 0) p.notifyTimer--;

  /* ── Gravity ── */
  p.vy += PHYS.GRAVITY;
  if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;

  /* ── Input (locked during knockback) ── */
  if (p.kbTimer === 0) {
    if (INPUT.LEFT.pressed) {
      p.vx = -PHYS.WALK;
      p.facing = -1;
    } else if (INPUT.RIGHT.pressed) {
      p.vx = PHYS.WALK;
      p.facing = 1;
    } else {
      p.vx = 0;
    }

    if (INPUT.A.just && p.onGround) {
      p.vy = PHYS.JUMP;
      p.onGround = false;
    }

    if (INPUT.B.just && p.attackTimer === 0) {
      const wdef    = getWeaponDef(p);
      p.attackTimer = wdef.recovery;
      p.swingId++;          /* new swing — enemies can be hit again */
    }

    if (INPUT.SELECT.just && p.weapons.length > 1) {
      p.weaponIdx = (p.weaponIdx + 1) % p.weapons.length;
      p.notifyText  = p.weapons[p.weaponIdx].toUpperCase().replace(/_/g, ' ');
      p.notifyTimer = 90;
    }
  } else {
    p.vx *= 0.82;
  }

  /* ── Collision resolution ── */
  const res = resolveCollision(p, md);
  p.x = res.x;  p.y = res.y;
  p.vx = res.vx; p.vy = res.vy;
  p.onGround = res.onGround;

  if (res.onGround && p.kbTimer > 0) p.kbTimer = 0;

  /* ── Tile interactions ── */
  checkPlayerTiles();
  /* Guard: transitionZone inside checkPlayerTiles replaces G.player.
     If p is now stale, abort — new player's first update runs next frame. */
  if (G.player !== p) return;

  /* ── Walk animation ── */
  if (p.onGround && Math.abs(p.vx) > 0.1) {
    if (++p.animTimer >= 8) { p.animTimer = 0; p.animFrame++; }
  } else {
    p.animTimer = 0;
  }

  /* ── Camera ── */
  Camera.follow(p);
}