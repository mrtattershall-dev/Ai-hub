function _drawCrawler(ctx, e) {
  const f = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = f ? PAL.WHITE : PAL.STONE_MID;
  const C2 = f ? PAL.WHITE : PAL.BLOOD_RED;
  /* Worm body — horizontal oval */
  ctx.fillStyle = C1;
  ctx.fillRect(1, 4, 12, 6);    /* main body */
  ctx.fillRect(0, 5, 14, 4);    /* wide mid */
  /* Segments */
  ctx.fillStyle = PAL.STONE_DARK;
  ctx.fillRect(4, 4, 1, 6);
  ctx.fillRect(8, 4, 1, 6);
  /* Eyes */
  ctx.fillStyle = C2;
  ctx.fillRect(1, 5, 2, 2);
  ctx.fillRect(4, 5, 2, 2);
  /* Legs — animated */
  const l = e.animFrame % 2 === 0;
  ctx.fillStyle = C1;
  ctx.fillRect(2,  l ? 9  : 8,  2, 3);
  ctx.fillRect(6,  l ? 8  : 9,  2, 3);
  ctx.fillRect(10, l ? 9  : 8,  2, 3);
}