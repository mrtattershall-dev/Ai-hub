function _drawMechConstruct(ctx, e) {
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = f ? PAL.WHITE : PAL.STONE_MID;
  const C2 = f ? PAL.WHITE : PAL.STONE_HIGH;
  const C3 = f ? PAL.WHITE : PAL.GOLD;
  /* Head box */
  ctx.fillStyle = C1;
  ctx.fillRect(2, 0, 10, 8);
  ctx.fillStyle = C2;
  ctx.fillRect(3, 1, 8, 2);    /* top panel */
  ctx.fillStyle = C3;
  ctx.fillRect(3, 3, 3, 3);    /* visor left */
  ctx.fillRect(8, 3, 3, 3);    /* visor right */
  /* Torso */
  ctx.fillStyle = C1;
  ctx.fillRect(1, 8, 12, 7);
  ctx.fillStyle = C2;
  ctx.fillRect(3, 10, 8, 4);   /* chest panel */
  ctx.fillStyle = C3;
  ctx.fillRect(5, 11, 4, 2);   /* power cell glow */
  /* Legs */
  const l = e.animFrame % 2 === 0 ? 1 : -1;
  ctx.fillStyle = C1;
  ctx.fillRect(2,  15 - l, 4, 5);
  ctx.fillRect(8,  15 + l, 4, 5);
}