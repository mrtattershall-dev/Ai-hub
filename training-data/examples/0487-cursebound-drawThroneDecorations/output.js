function drawThroneDecorations(ctx, cols) {
  const T     = NES.TILE;
  const ROWS  = 20;
  const zpal  = ZONE_PAL[ZONE_ID.THRONE];
  const mapH  = ROWS * T;

  /* ── Floor-to-ceiling pillars ── */
  [6, 12, 20, 28, 34, 42].forEach(col => {
    const px2 = col * T + 6;
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(px2, 0, 4, mapH);
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(px2 - 2, T, 8, 3);
    ctx.fillStyle = zpal.solidShad;
    for (let y = T * 3; y < mapH - T * 2; y += T * 2) {
      ctx.fillRect(px2, y, 4, 2);
    }
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(px2 - 2, mapH - T * 2, 8, 3);
  });

  /* ── Curse rune chains — 1px dots ── */
  ctx.fillStyle = zpal.solidTop;
  for (let step = 0; step < 180; step++) {
    const x = ((step * 3) % (cols * T)) | 0;
    const y = (step * 2 + T * 4) | 0;
    if (y < mapH - T * 2) ctx.fillRect(x, y, 1, 1);
  }

  /* ── Throne silhouette — grey-on-grey, subtle ── */
  const tx = 22 * T;
  ctx.fillStyle = zpal.solidBase;
  ctx.fillRect(tx, T, T * 4, T * 3);
  ctx.fillStyle = zpal.solidTop;
  ctx.fillRect(tx + T, 0, T * 2, T * 2);
  ctx.fillStyle = zpal.solidBase;
  ctx.fillRect(tx, T + 4, T, T);
  ctx.fillRect(tx + T * 3, T + 4, T, T);
  /* Crown spikes — pale grey, not gold (curse stripped colour) */
  ctx.fillStyle = zpal.platformTop;
  [tx + 2, tx + T, tx + T * 2, tx + T * 3 - 2].forEach(sx => {
    ctx.fillRect(sx, 0, 3, T - 4);
    ctx.fillRect(sx + 1, 0 - 2, 1, 2);
  });

  /* ── Boss door frame — only colour in the zone: blood red ── */
  const doorX = 22 * T;
  const doorY = 19 * T;
  ctx.fillStyle = PAL.BLOOD_RED;
  ctx.fillRect(doorX - 4, doorY - 8, 4, T + 8);
  ctx.fillRect(doorX + T * 2, doorY - 8, 4, T + 8);
  ctx.fillStyle = PAL.FIRE_RED;
  ctx.fillRect(doorX - 4, doorY - 8, T * 2 + 8, 4);
  ctx.fillStyle = zpal.solidShad;
  ctx.fillRect(doorX, doorY, T * 2, T);
  /* Warning rune dots */
  ctx.fillStyle = PAL.FIRE_RED;
  ctx.fillRect(doorX - 3, doorY,     2, 2);
  ctx.fillRect(doorX - 3, doorY + 4, 2, 2);
  ctx.fillRect(doorX - 3, doorY + 8, 2, 2);
  ctx.fillRect(doorX + T * 2 + 1, doorY,     2, 2);
  ctx.fillRect(doorX + T * 2 + 1, doorY + 4, 2, 2);
  ctx.fillRect(doorX + T * 2 + 1, doorY + 8, 2, 2);

  /* ── Debris scatter ── */
  ctx.fillStyle = zpal.solidBase;
  [[8,32],[40,48],[96,80],[144,32],[200,64],[280,48],
   [80,128],[160,160],[240,192],[320,128],[400,144]].forEach(([x, y]) => {
    ctx.fillRect(x, y, 2, 2);
  });
}