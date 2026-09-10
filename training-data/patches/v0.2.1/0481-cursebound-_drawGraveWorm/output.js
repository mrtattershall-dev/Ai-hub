function _drawGraveWorm(ctx, e) {
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = f ? PAL.WHITE : PAL.STONE_HIGH;
  const C2 = f ? PAL.WHITE : PAL.BLOOD_RED;
  const bob = e.animFrame % 2 === 0 ? 0 : 1;
  ctx.fillStyle = C1;
  ctx.fillRect(2, bob, 6, 8);   /* body */
  ctx.fillRect(1, bob + 2, 8, 4); /* mid wide */
  ctx.fillStyle = C2;
  ctx.fillRect(3, bob, 2, 2);   /* eye */
  ctx.fillStyle = PAL.STONE_DARK;
  ctx.fillRect(2, bob + 4, 6, 2); /* underbelly line */
}