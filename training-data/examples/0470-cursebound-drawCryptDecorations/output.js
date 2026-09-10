function drawCryptDecorations(ctx, cols) {
  const T    = NES.TILE;
  const zpal = ZONE_PAL[ZONE_ID.CRYPT];

  /* ── Stalactites — dark blue stone dripping from ceiling ── */
  [4, 12, 22, 32, 44, 54].forEach(col => {
    const dx = col * T + 6;
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(dx,     T * 2,      4, 3);
    ctx.fillRect(dx + 1, T * 2 + 3,  2, 4);
    ctx.fillRect(dx + 1, T * 2 + 7,  2, 2);
    ctx.fillRect(dx + 1, T * 2 + 9,  2, 1);
    /* Drip — bright blue water bead */
    ctx.fillStyle = zpal.platformTop;
    ctx.fillRect(dx + 2, T * 2 + 8, 1, 6);
    ctx.fillRect(dx + 2, T * 2 + 14, 2, 2);
  });

  /* ── Grave marker niches ── */
  [[1, 2], [1, 5]].forEach(([col, row]) => {
    const nx = col * T, ny = row * T;
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(nx + 2, ny + 2, 10, 12);
    ctx.fillRect(nx + 4, ny,     6,  3);
    ctx.fillRect(nx + 6, ny - 2, 2,  2);
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(nx + 1, ny + 2, 2,  12);
    ctx.fillRect(nx + 11,ny + 2, 2,  12);
    ctx.fillRect(nx + 2, ny + 1, 10, 2);
    /* Grave cross */
    ctx.fillStyle = zpal.platformTop;
    ctx.fillRect(nx + 6, ny + 5, 2, 6);
    ctx.fillRect(nx + 4, ny + 7, 6, 2);
    /* Eye sockets on skull */
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(nx + 5, ny + 10, 4, 3);
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(nx + 6, ny + 11, 1, 1);
    ctx.fillRect(nx + 8, ny + 11, 1, 1);
  });

  /* ── Bone piles ── */
  [[9, 9], [18, 9], [29, 9]].forEach(([col, row]) => {
    const bx = col * T, by = row * T - 4;
    ctx.fillStyle = PAL.LIGHTGRAY;
    ctx.fillRect(bx,     by + 2, 8, 2);
    ctx.fillRect(bx + 2, by,     2, 5);
    ctx.fillStyle = PAL.MIDGRAY;
    ctx.fillRect(bx + 5, by + 3, 6, 2);
    ctx.fillRect(bx + 6, by + 1, 2, 4);
    /* Skull */
    ctx.fillStyle = PAL.LIGHTGRAY;
    ctx.fillRect(bx + 8, by,     5, 4);
    ctx.fillRect(bx + 9, by + 4, 3, 2);
    ctx.fillStyle = PAL.DARKGRAY;
    ctx.fillRect(bx + 9, by + 1, 1, 2);
    ctx.fillRect(bx +11, by + 1, 1, 2);
  });

  /* ── Water stain streaks on walls ── */
  ctx.fillStyle = zpal.solidTop;
  [2, 16, 36, 52].forEach(col => {
    const wx = col * T + T - 2;
    for (let seg = 0; seg < 5; seg++) {
      ctx.fillRect(wx, T * 2 + seg * 14, 1, 10 + (seg % 3));
    }
  });

  /* ── Floor cracks ── */
  ctx.fillStyle = zpal.solidShad;
  [6, 15, 26, 38, 50].forEach(col => {
    const fx = col * T, fy = 9 * T;
    ctx.fillRect(fx + 2, fy + 4, 8, 1);
    ctx.fillRect(fx + 6, fy + 2, 1, 5);
    ctx.fillRect(fx + 8, fy + 5, 4, 1);
  });

  /* ── Moss smears on lower walls ── */
  ctx.fillStyle = zpal.solidBase;
  [3, 20, 40, 58].forEach(col => {
    const mx = col * T, my = 8 * T;
    ctx.fillRect(mx,     my + 4, T + 4, 3);
    ctx.fillRect(mx + 2, my + 2, T,     2);
    ctx.fillRect(mx + 4, my + 6, T - 2, 2);
  });
}