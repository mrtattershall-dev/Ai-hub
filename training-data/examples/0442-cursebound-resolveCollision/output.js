function resolveCollision(entity, mapData) {
  const T16 = NES.TILE;
  let { x, y, w, h, vx, vy } = entity;
  let onGround = false, hitCeiling = false, hitWallL = false, hitWallR = false;

  /* ── X axis ── */
  x += vx;
  if (vx !== 0) {
    const left  = (x / T16) | 0;
    const right = ((x + w - 1) / T16) | 0;
    const top   = ((y + 1) / T16) | 0;
    const bot   = ((y + h - 2) / T16) | 0;
    if (vx > 0) {
      /* moving right — check right edge at top and bottom of entity */
      if (tileIsSolid(tileAt(mapData, right, top)) ||
          tileIsSolid(tileAt(mapData, right, bot))) {
        x = right * T16 - w;
        vx = 0; hitWallR = true;
      }
    } else {
      /* moving left — check left edge */
      if (tileIsSolid(tileAt(mapData, left, top)) ||
          tileIsSolid(tileAt(mapData, left, bot))) {
        x = (left + 1) * T16;
        vx = 0; hitWallL = true;
      }
    }
  }

  /* ── Y axis ── */
  y += vy;
  {
    const left  = ((x + 1) / T16) | 0;
    const right = ((x + w - 2) / T16) | 0;
    const top   = (y / T16) | 0;
    const bot   = ((y + h) / T16) | 0;

    if (vy >= 0) {
      /* falling or standing — check bottom edge; include one-way platforms */
      const tL = tileAt(mapData, left,  bot);
      const tR = tileAt(mapData, right, bot);
      const solidDown = tileIsSolid(tL) || tileIsSolid(tR) ||
        ((tileIsOneway(tL) || tileIsOneway(tR)) && ((y - vy) + h) <= bot * T16);
      if (solidDown) {
        y = bot * T16 - h;
        vy = 0; onGround = true;
      }
    } else {
      /* rising — check top edge, solid only */
      if (tileIsSolid(tileAt(mapData, left,  top)) ||
          tileIsSolid(tileAt(mapData, right, top))) {
        y = (top + 1) * T16;
        vy = 0; hitCeiling = true;
      }
    }
  }

  return { x, y, vx, vy, onGround, hitCeiling, hitWallL, hitWallR };
}