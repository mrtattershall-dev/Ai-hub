function drawCastleSilhouette(ctx) {
  ctx.fillStyle = PAL.STONE_DARK;

  /* Base ramparts */
  ctx.fillRect(0, 160, 256, 64);

  /* Tower left */
  ctx.fillRect(10, 110, 30, 50);
  ctx.fillRect(8,  105, 6, 6);    /* battlement */
  ctx.fillRect(18, 105, 6, 6);
  ctx.fillRect(28, 105, 6, 6);

  /* Tower center-left */
  ctx.fillRect(60, 120, 40, 40);
  ctx.fillRect(58, 114, 8, 8);
  ctx.fillRect(72, 114, 8, 8);
  ctx.fillRect(86, 114, 8, 8);

  /* Main keep */
  ctx.fillRect(108, 95, 48, 65);
  ctx.fillRect(106, 87, 10, 10);
  ctx.fillRect(122, 87, 10, 10);
  ctx.fillRect(138, 87, 10, 10);

  /* Clocktower spire */
  ctx.fillRect(124, 60, 12, 35);
  /* spire tip */
  ctx.fillRect(128, 52, 4, 10);
  ctx.fillRect(129, 46, 2, 8);
  ctx.fillRect(130, 42, 1, 6);

  /* Tower center-right */
  ctx.fillRect(160, 118, 36, 42);
  ctx.fillRect(158, 112, 8, 8);
  ctx.fillRect(172, 112, 8, 8);
  ctx.fillRect(184, 112, 8, 8);

  /* Tower right */
  ctx.fillRect(210, 112, 34, 48);
  ctx.fillRect(208, 106, 6, 8);
  ctx.fillRect(220, 106, 6, 8);
  ctx.fillRect(232, 106, 6, 8);

  /* Moon */
  ctx.fillStyle = PAL.LIGHTGRAY;
  ctx.beginPath();
  ctx.arc(210, 50, 18, 0, Math.PI * 2);
  ctx.fill();

  /* Moon shadow (crescent) */
  ctx.fillStyle = PAL.STONE_DARK;
  ctx.beginPath();
  ctx.arc(218, 46, 16, 0, Math.PI * 2);
  ctx.fill();

  /* Stars */
  ctx.fillStyle = PAL.WHITE;
  [[30,30],[55,18],[80,40],[148,25],[178,35],[230,20]].forEach(([x,y]) => {
    ctx.fillRect(x, y, 1, 1);
  });
  [[40,50],[70,55],[160,48],[200,28]].forEach(([x,y]) => {
    ctx.fillRect(x, y, 2, 2);
  });
}