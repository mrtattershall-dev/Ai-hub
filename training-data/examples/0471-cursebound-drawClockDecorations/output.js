function drawClockDecorations(ctx, cols) {
  const T    = NES.TILE;
  const zpal = ZONE_PAL[ZONE_ID.CLOCK];

  /* ── Large clock face — centre, rows 8-9 ── */
  const cx = 22 * T + T, cy = 8 * T + 4, R = 18;
  /* Dial body */
  ctx.fillStyle = zpal.solidBase;
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.sqrt(Math.max(0, R*R - dy*dy)) | 0;
    ctx.fillRect(cx - hw, cy + dy, hw*2, 1);
  }
  /* Dial ring */
  ctx.fillStyle = zpal.solidTop;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    ctx.fillRect((cx + Math.cos(ang)*(R-1))|0, (cy + Math.sin(ang)*(R-1))|0, 2, 2);
  }
  /* Hour markers */
  ctx.fillStyle = zpal.platformTop;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const sz  = (i % 3 === 0) ? 2 : 1;
    ctx.fillRect((cx + Math.cos(ang)*(R-4))|0, (cy + Math.sin(ang)*(R-4))|0, sz, sz);
  }
  /* Hands stopped at 3:00 */
  ctx.fillStyle = zpal.solidTop;
  ctx.fillRect(cx, cy - 1, R - 5, 2);      /* hour → 3 */
  ctx.fillStyle = zpal.platformTop;
  ctx.fillRect(cx - 1, cy - R + 5, 2, R - 5); /* minute ↑ 12 */
  /* Centre pin */
  ctx.fillStyle = PAL.PALE_GOLD;
  ctx.fillRect(cx - 1, cy - 1, 3, 3);

  /* ── Three gears ── */
  [[6*T, 8*T, 12], [36*T, 9*T, 10], [14*T, 5*T, 8]].forEach(([gx, gy, gr]) => {
    ctx.fillStyle = zpal.solidTop;
    for (let tooth = 0; tooth < 8; tooth++) {
      const ang = (tooth / 8) * Math.PI * 2;
      ctx.fillRect((gx + Math.cos(ang)*(gr+2) - 2)|0, (gy + Math.sin(ang)*(gr+2) - 2)|0, 4, 4);
    }
    ctx.fillStyle = zpal.solidBase;
    for (let dy = -gr; dy <= gr; dy++) {
      const hw = Math.sqrt(Math.max(0, gr*gr - dy*dy)) | 0;
      ctx.fillRect(gx - hw, gy + dy, hw*2, 1);
    }
    ctx.fillStyle = zpal.solidTop;
    for (let s = 0; s < 4; s++) {
      const ang = (s / 4) * Math.PI * 2;
      ctx.fillRect((gx + Math.cos(ang)*(gr*0.5) - 1)|0, (gy + Math.sin(ang)*(gr*0.5) - 1)|0, 2, 2);
    }
    ctx.fillStyle = PAL.PALE_GOLD;
    ctx.fillRect(gx - 2, gy - 2, 4, 4);
    ctx.fillStyle = PAL.WHITE;
    ctx.fillRect(gx - 1, gy - 1, 2, 2);
  });

  /* ── Pendulum housing on left wall ── */
  ctx.fillStyle = zpal.solidShad;
  ctx.fillRect(T, 4*T,  8, 8*T);
  ctx.fillStyle = zpal.solidTop;
  ctx.fillRect(T, 4*T,  8, 2);
  ctx.fillRect(T, 12*T, 8, 2);
  ctx.fillStyle = zpal.solidBase;
  ctx.fillRect(T - 4, 10*T, 16, 8);
  ctx.fillStyle = zpal.solidTop;
  ctx.fillRect(T - 4, 10*T, 16, 2);
  ctx.fillStyle = PAL.PALE_GOLD;
  ctx.fillRect(T, 10*T + 2, 8, 4);

  /* ── Chain links on right wall ── */
  ctx.fillStyle = zpal.solidBase;
  for (let cy2 = 2*T; cy2 < 14*T; cy2 += 8) {
    ctx.fillRect(cols*T - 2*T + 4, cy2,     8, 4);
    ctx.fillRect(cols*T - 2*T + 6, cy2 + 4, 4, 4);
  }

  /* ── Gear debris on platforms ── */
  ctx.fillStyle = zpal.solidBase;
  [[8,8],[16,8],[30,8],[40,8]].forEach(([col, row]) => {
    const dx = col * T, dy = row * T - 4;
    ctx.fillRect(dx,     dy + 2, 6, 2);
    ctx.fillRect(dx + 2, dy,     2, 6);
    ctx.fillRect(dx + 2, dy + 2, 2, 2);
    ctx.fillStyle = PAL.PALE_GOLD;
    ctx.fillRect(dx + 3, dy + 3, 1, 1);
    ctx.fillStyle = zpal.solidBase;
  });
}