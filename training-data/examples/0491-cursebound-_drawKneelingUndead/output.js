function _drawKneelingUndead(ctx, e) {
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const CB = f ? PAL.WHITE : PAL.STONE_HIGH;
  const CD = f ? PAL.WHITE : PAL.STONE_DARK;
  const isKneeling = e.h <= 12;
  const isRising   = e.state === 'rising';

  if (isKneeling) {
    /* Crouched skull visible at ground level */
    ctx.fillStyle = CB;
    ctx.fillRect(2, 2, 8, 6);   /* skull */
    ctx.fillStyle = CD;
    ctx.fillRect(3, 3, 2, 2);   /* eye L */
    ctx.fillRect(7, 3, 2, 2);   /* eye R */
    ctx.fillStyle = CB;
    ctx.fillRect(3, 8, 6, 2);   /* folded body */
    return;
  }

  /* Rising / standing — proportion based on current h */
  const scaleY = e.h / 20;
  const headY  = Math.max(0, Math.round(2 - scaleY * 2));

  ctx.fillStyle = CB;
  ctx.fillRect(3, headY,     6, 5);              /* skull */
  ctx.fillStyle = CD;
  ctx.fillRect(4, headY + 1, 2, 2);             /* eye L */
  ctx.fillRect(8, headY + 1, 2, 2);             /* eye R */
  ctx.fillStyle = CB;
  ctx.fillRect(4, headY + 5, 2, 2);             /* neck */
  ctx.fillRect(2, headY + 7, 8, 4);             /* torso */
  ctx.fillStyle = CD;
  ctx.fillRect(4, headY + 8, 4, 2);             /* rib */

  if (!isRising) {
    /* Full legs only when fully risen */
    const leg = e.animFrame % 2 === 0 ? 1 : -1;
    ctx.fillStyle = CB;
    ctx.fillRect(3, headY + 11 - leg, 3, 8);
    ctx.fillRect(6, headY + 11 + leg, 3, 8);
  } else {
    /* Partial legs emerging from ground */
    ctx.fillStyle = CB;
    ctx.fillRect(3, headY + 11, 3, Math.round((e.h - 10) * 0.8));
    ctx.fillRect(6, headY + 11, 3, Math.round((e.h - 10) * 0.6));
  }
}