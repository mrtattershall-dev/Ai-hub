function drawSanctumDecorations(ctx, cols) {
  const ROWS  = 14;
  const T     = NES.TILE;
  const zpal  = ZONE_PAL[ZONE_ID.SANCTUM];

  /* ── Pew backs ── */
  const pewCols = [8, 24, 40];
  pewCols.forEach(col => {
    const px2 = col * T;
    const backY = 4 * T + 4;
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(px2, backY, T * 2, 10);
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(px2 + 2, backY + 2, T * 2 - 4, 2);
    ctx.fillRect(px2 + 2, backY + 6, T * 2 - 4, 1);
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(px2, backY, T * 2, 2);
    ctx.fillStyle = zpal.platformMid;
    ctx.fillRect(px2 + 2, 5 * T + T, T * 2 - 4, 3);
  });

  /* ── Altar ── */
  const altarX = 42 * T;
  const altarY = 6 * T;
  ctx.fillStyle = zpal.solidBase;
  ctx.fillRect(altarX, altarY - 4, 8 * T, 8);
  ctx.fillStyle = zpal.solidTop;
  ctx.fillRect(altarX, altarY - 4, 8 * T, 2);
  ctx.fillStyle = PAL.PALE_GOLD;
  ctx.fillRect(altarX + 4, altarY - 6, 8, 3);
  ctx.fillRect(altarX + T * 6, altarY - 6, 8, 3);

  /* ── Altar candles ── */
  [[altarX + 6, altarY - 12], [altarX + T * 7 - 4, altarY - 12]].forEach(([cx2, cy2]) => {
    ctx.fillStyle = PAL.STONE_HIGH;
    ctx.fillRect(cx2, cy2 + 4, 4, 8);
    ctx.fillStyle = '#f8f8d8';
    ctx.fillRect(cx2, cy2 + 2, 4, 3);
    ctx.fillStyle = PAL.FIRE_RED;
    ctx.fillRect(cx2 + 1, cy2, 2, 3);
    ctx.fillStyle = PAL.PALE_GOLD;
    ctx.fillRect(cx2 + 1, cy2 - 1, 2, 1);
  });

  /* ── Inverted cross — blood red on purple wall ── */
  const crossX = 47 * T;
  const crossY = 5 * T;
  ctx.fillStyle = PAL.FIRE_RED;
  ctx.fillRect(crossX + 6, crossY,      4, 12);
  ctx.fillRect(crossX + 2, crossY + 4,  12, 4);
  ctx.fillStyle = PAL.BLOOD_RED;
  ctx.fillRect(crossX + 5, crossY - 1,  6, 1);
  ctx.fillRect(crossX + 5, crossY + 12, 6, 1);

  /* ── Floor cracks ── */
  ctx.fillStyle = zpal.solidShad;
  [[10, 9], [22, 9], [30, 9]].forEach(([col, row]) => {
    const cx2 = col * T, cy2 = row * T;
    ctx.fillRect(cx2 + 3, cy2 + 5, 6, 1);
    ctx.fillRect(cx2 + 6, cy2 + 3, 1, 4);
  });

  /* ── Pointed arch windows — purple recess ── */
  [6, 18, 32].forEach(col => {
    const ax = col * T, ay = T;
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(ax,         ay, 3, 10);
    ctx.fillRect(ax + T - 3, ay, 3, 10);
    ctx.fillRect(ax + 3, ay, T - 6, 4);
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(ax + 5, ay - 2, T - 10, 2);
    ctx.fillRect(ax + 7, ay - 4, T - 14, 2);
  });
}