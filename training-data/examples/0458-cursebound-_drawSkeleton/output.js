function _drawSkeleton(ctx, e) {
  const flash = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const CB = flash ? PAL.WHITE : PAL.LIGHTGRAY;
  const CD = flash ? PAL.WHITE : PAL.STONE_DARK;

  ctx.fillStyle = CB;
  ctx.fillRect(4, 0, 6, 5);              /* skull */
  ctx.fillStyle = CD;
  ctx.fillRect(4, 1, 2, 2);              /* left eye  */
  ctx.fillRect(8, 1, 2, 2);              /* right eye */
  ctx.fillRect(6, 4, 2, 1);              /* jaw gap   */
  ctx.fillStyle = CB;
  ctx.fillRect(6, 5, 2, 2);              /* neck */
  ctx.fillRect(3, 7, 8, 4);              /* ribcage */
  ctx.fillStyle = CD;
  ctx.fillRect(5, 8, 4, 2);              /* rib shadow */
  ctx.fillStyle = CB;
  ctx.fillRect(0, 9, 3, 2);              /* left arm  */
  ctx.fillRect(11, 9, 3, 2);             /* right arm */
  ctx.fillRect(4, 11, 6, 3);             /* pelvis */
  const leg = e.animFrame % 2 === 0 ? 1 : -1;
  ctx.fillRect(4, 14 - leg, 3, 8);       /* left leg  */
  ctx.fillRect(7, 14 + leg, 3, 8);       /* right leg */
}