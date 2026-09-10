function drawEntryDecorations(ctx, cols) {
  const T    = NES.TILE;
  const zpal = ZONE_PAL[ZONE_ID.ENTRY];

  /* ── Background arched windows — dark stone recesses in wall ── */
  [8, 28, 48].forEach(col => {
    const wx = col * T, wy = T;
    /* Window void — darker than wall */
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(wx + 2, wy + 2, T*2 - 4, T*4 - 2);
    ctx.fillRect(wx + 4, wy,     T*2 - 8, 3);
    ctx.fillRect(wx + 6, wy - 2, T*2 - 12, 2);
    /* Window stone frame */
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(wx + 1, wy + 1, 2, T*4);
    ctx.fillRect(wx + T*2 - 3, wy + 1, 2, T*4);
    ctx.fillRect(wx + 2, wy, T*2 - 4, 2);
    /* Cross pane — mortar brown */
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(wx + T - 1, wy + 2, 2, T*4 - 4);
    ctx.fillRect(wx + 3, wy + T*2, T*2 - 6, 2);
  });

  /* ── Chandeliers ── */
  [Math.floor(cols * 0.2), Math.floor(cols * 0.5), Math.floor(cols * 0.8)].forEach(col => {
    const cx = col * T + 8, cy = T;
    /* Ceiling mount */
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(cx - 2, cy, 4, 2);
    /* Chain */
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(cx - 1, cy + 2, 2, 13);
    /* Crosspiece */
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(cx - 12, cy + 15, 24, 4);
    ctx.fillStyle = zpal.solidTop;
    ctx.fillRect(cx - 12, cy + 15, 24, 1);
    ctx.fillStyle = zpal.solidShad;
    ctx.fillRect(cx - 14, cy + 16, 3, 3);
    ctx.fillRect(cx + 11, cy + 16, 3, 3);
    /* Four candles */
    [-8, -3, 3, 8].forEach(dx => {
      const cx2 = cx + dx;
      ctx.fillStyle = PAL.STONE_HIGH;
      ctx.fillRect(cx2, cy + 18, 2, 3);  /* wax */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(cx2, cy + 20, 2, 5);  /* candle */
      ctx.fillStyle = PAL.FIRE_RED;
      ctx.fillRect(cx2, cy + 17, 2, 2);  /* flame base */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(cx2, cy + 16, 2, 1);  /* flame tip */
    });
    /* Warm pool of light below */
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(cx - 14, 9*T, 28, 1);
  });

  /* ── Cobwebs in upper corners ── */
  ctx.fillStyle = zpal.solidTop;
  for (let r = 4; r <= 28; r += 4) {
    ctx.fillRect(T,         T + r, r, 1);
    ctx.fillRect(T + r,     T,     1, r);
    if (r >= 8) ctx.fillRect(T + (r>>1), T + (r>>1), 1, 1);
  }
  [[4,20],[8,16],[12,12],[16,8],[20,4]].forEach(([ax,ay]) => {
    ctx.fillRect(T + ax, T + ay, 1, 1);
  });
  const rEdge = (cols - 2) * T;
  for (let r = 4; r <= 28; r += 4) {
    ctx.fillRect(rEdge - r,  T + r, r, 1);
    ctx.fillRect(rEdge,      T,     1, r);
    if (r >= 8) ctx.fillRect(rEdge - (r>>1), T + (r>>1), 1, 1);
  }

  /* ── Wall torches ── */
  [18, 38, 58].forEach(col => {
    const tx = col * T + 4, ty = T * 3;
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(tx, ty + 2, 6, 2);
    ctx.fillRect(tx + 2, ty, 2, 4);
    ctx.fillStyle = zpal.solidBase;
    ctx.fillRect(tx + 2, ty + 4, 2, 6);
    ctx.fillStyle = PAL.FIRE_RED;
    ctx.fillRect(tx + 1, ty,     4, 2);
    ctx.fillStyle = PAL.PALE_GOLD;
    ctx.fillRect(tx + 2, ty - 1, 2, 2);
  });

  /* ── Floor flagstone joints ── */
  ctx.fillStyle = zpal.solidShad;
  [5, 14, 22, 31, 40, 50].forEach(col => {
    const fx = col * T;
    ctx.fillRect(fx, 9*T + 6, T, 1);
    ctx.fillRect(fx + T - 1, 9*T, 1, T - 2);
  });
}