function _drawCursedPriest(ctx, e) {
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  /* Sanctum palette: deep purple + corrupt gold + glowing void-white eyes */
  const ROBE_D  = f ? PAL.WHITE : '#2a1e38';   /* dark robe body       */
  const ROBE_M  = f ? PAL.WHITE : PAL.CLOAK_DARK;   /* robe mid highlight   */
  const GOLD_C  = f ? PAL.WHITE : PAL.GOLD;    /* staff / trim         */
  const EYE_C   = f ? PAL.WHITE : PAL.CLOAK_LITE;   /* corrupted glow eyes  */

  /* Hood */
  ctx.fillStyle = ROBE_D;
  ctx.fillRect(3, 0, 6, 3);
  ctx.fillRect(2, 2, 8, 3);

  /* Face — sunken, partially visible under hood */
  ctx.fillStyle = PAL.STONE_MID;
  ctx.fillRect(3, 3, 6, 3);
  ctx.fillStyle = EYE_C;
  ctx.fillRect(4, 4, 2, 1);   /* left glowing eye */
  ctx.fillRect(7, 4, 2, 1);   /* right glowing eye */

  /* Robe body */
  ctx.fillStyle = ROBE_D;
  ctx.fillRect(2, 6, 8, 9);
  ctx.fillStyle = ROBE_M;
  ctx.fillRect(4, 7, 4, 7);   /* robe centre seam */

  /* Gold trim on robe hem */
  ctx.fillStyle = GOLD_C;
  ctx.fillRect(2, 14, 8, 1);

  /* Staff — held to the right */
  ctx.fillStyle = GOLD_C;
  ctx.fillRect(10, 4, 2, 12);   /* staff shaft */
  ctx.fillRect(8,  3, 6, 2);    /* staff crosspiece */
  ctx.fillStyle = EYE_C;
  ctx.fillRect(10, 2, 2, 2);    /* glowing orb top */

  /* Robe hem / feet */
  ctx.fillStyle = ROBE_D;
  ctx.fillRect(3, 15, 3, 4);    /* left foot-hem */
  ctx.fillRect(7, 15, 3, 4);    /* right foot-hem */
}