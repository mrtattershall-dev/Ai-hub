function _drawBat(ctx, e) {
  const flash  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = flash ? PAL.WHITE : PAL.CLOAK_DARK;
  const C2 = flash ? PAL.WHITE : PAL.CLOAK_MID;
  const CE = flash ? PAL.WHITE : PAL.BLOOD_RED;
  const up = e.animFrame % 2 === 0;      /* wing flap */

  ctx.fillStyle = C1;
  ctx.fillRect(0,  up ? 2 : 5, 4, 4);   /* left wing  */
  ctx.fillRect(10, up ? 2 : 5, 4, 4);   /* right wing */
  ctx.fillStyle = C2;
  ctx.fillRect(1,  up ? 3 : 6, 3, 2);   /* left membrane  */
  ctx.fillRect(10, up ? 3 : 6, 3, 2);   /* right membrane */
  ctx.fillStyle = C1;
  ctx.fillRect(4, 3, 6, 6);             /* body */
  ctx.fillStyle = CE;
  ctx.fillRect(5, 4, 2, 2);             /* left eye  */
  ctx.fillRect(8, 4, 2, 2);             /* right eye */
}