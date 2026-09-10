function _drawArmoredGuard(ctx, e) {
  const flash = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = flash ? PAL.WHITE : PAL.STONE_MID;
  const C2 = flash ? PAL.WHITE : PAL.STONE_HIGH;
  const C3 = flash ? PAL.WHITE : PAL.STONE_DARK;

  ctx.fillStyle = C1;
  ctx.fillRect(1, 0, 12, 8);             /* helmet body */
  ctx.fillStyle = C2;
  ctx.fillRect(2, 0, 10, 2);             /* helmet top  */
  ctx.fillStyle = C3;
  ctx.fillRect(3, 2, 3, 3);              /* visor left  */
  ctx.fillRect(8, 2, 3, 3);              /* visor right */
  ctx.fillStyle = C1;
  ctx.fillRect(0, 8, 14, 7);             /* armored torso */
  ctx.fillStyle = C2;
  ctx.fillRect(2, 9, 10, 4);             /* chest plate   */
  ctx.fillStyle = C3;
  ctx.fillRect(6, 10, 2, 2);             /* chest line    */
  ctx.fillStyle = C1;
  const leg = e.animFrame % 2 === 0 ? 1 : -1;
  ctx.fillRect(1, 15 - leg, 5, 7);       /* left leg  */
  ctx.fillRect(8, 15 + leg, 5, 7);       /* right leg */
}