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

    /* Coyote time: allow jump up to 8 frames after walking off a ledge */
    if (!p.onGround) {
      p.coyoteTimer = Math.max(0, (p.coyoteTimer || 0) - 1);
    } else {
      p.coyoteTimer = 8;  /* reset when grounded */
    }
    /* Jump buffer: remember jump input for up to 8 frames before landing */
    if (INPUT.A.just) p.jumpBuffer = 8;
    /* Check BEFORE decrement so full 8 frames are available */
    if ((INPUT.A.just || p.jumpBuffer > 0) && (p.onGround || p.coyoteTimer > 0)) {
      p.vy = PHYS.JUMP;
      p.onGround    = false;
      p.coyoteTimer = 0;
      p.jumpBuffer  = 0;
    } else if (p.jumpBuffer > 0) {
      p.jumpBuffer--;       /* count down only if jump didn't fire */
    }

    if (INPUT.B.just && p.attackTimer === 0) {
      const wdef    = getWeaponDef(p);
      p.attackTimer = wdef.recovery;
      p.swingId++;
      const wName = p.weapons[p.weaponIdx];
      /* Cursed dagger: fast forward projectile */
      if (wName === 'cursed_dagger') {
        projectiles.push({
          x: p.x + (p.facing === 1 ? p.w : -8), y: p.y + (p.h >> 1) - 2,
          vx: p.facing * 5.5, vy: 0,
          w: 8, h: 4, life: 28, damage: 1, src: 'dagger',
          swingId: p.swingId,
        });
      }
      /* Holy axe: arc projectile that rises then falls */
      if (wName === 'holy_axe') {
        projectiles.push({
          x: p.x + (p.facing === 1 ? p.w : -6), y: p.y + (p.h >> 1) - 6,
          vx: p.facing * 2.4, vy: -3.8,
          w: 8, h: 8, life: 72, damage: 2, src: 'axe', gravity: true,
          rotation: 0, swingId: p.swingId,
        });
      }
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