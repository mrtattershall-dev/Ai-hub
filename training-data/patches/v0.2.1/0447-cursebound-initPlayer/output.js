function initPlayer(zoneId) {
  const zone = ZONES[zoneId];
  if (!zone) return;
  const spawnX = (zone.spawnTX != null ? zone.spawnTX : 3) * NES.TILE;
  const spawnY = (zone.spawnTY != null ? zone.spawnTY : 10) * NES.TILE - PHYS.PLAYER_H;

  Camera.reset();   /* always reset — prevents camera snap on respawn */

  G.player = {
    /* Position + velocity (hitbox top-left) */
    x: spawnX, y: spawnY,
    w: PHYS.PLAYER_W, h: PHYS.PLAYER_H,
    vx: 0, vy: 0,

    /* State flags */
    onGround:  false,
    facing:    1,         /* 1=right  -1=left */

    /* Combat */
    hp:        6,
    maxHp:     6,
    iFrames:   0,         /* invincibility frames remaining */
    kbTimer:   0,         /* knockback frames remaining */
    attackTimer: 0,       /* attack animation frames remaining */

    /* Animation */
    animFrame: 0,
    animTimer: 0,

    /* Inventory — sword always present; re-add anything collected this run */
    weapons:    ['sword', ...Array.from(G.collectedWeapons)],
    weaponIdx:  0,
    swingId:    0,     /* increments each attack swing — deduplicates enemy hits */

    /* Notification text for pickups */
    notifyText: '',
    notifyTimer: 0,
  };
  if (DEBUG) console.log(`[player] spawned at (${spawnX}, ${spawnY})`);
}