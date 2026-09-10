function _drawClockworkBird(ctx, e) {
  const f   = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1  = f ? PAL.WHITE : PAL.STONE_MID;
  const C2  = f ? PAL.WHITE : PAL.GOLD;
  const flap = e.animFrame % 2 === 0;
  /* Wings */
  ctx.fillStyle = C1;
  ctx.fillRect(-2, flap ? 2 : 4, 4, 4);
  ctx.fillRect(10, flap ? 2 : 4, 4, 4);
  /* Body */
  ctx.fillStyle = C1;
  ctx.fillRect(2, 3, 8, 5);
  /* Gear eye */
  ctx.fillStyle = C2;
  ctx.fillRect(4, 4, 2, 2);
  ctx.fillRect(7, 4, 2, 2);
  /* Beak */
  ctx.fillStyle = C2;
  ctx.fillRect(10, 5, 3, 2);
}