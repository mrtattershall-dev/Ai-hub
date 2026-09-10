function _drawGhost(ctx, e) {
  if (e.phasing && (G.frame % 4) < 2) return;  /* flicker while phasing */
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const alpha = e.phasing ? 0.4 : 1;
  ctx.globalAlpha = alpha;
  const C1 = f ? PAL.WHITE : PAL.CLOAK_LITE;
  const C2 = f ? PAL.WHITE : PAL.WHITE;
  const wave = e.animFrame % 2 === 0 ? 0 : 1;
  /* Shroud */
  ctx.fillStyle = C1;
  ctx.fillRect(2, 0, 10, 10);
  ctx.fillRect(1, 3, 12, 6);
  ctx.fillRect(2, 10, 4, 3 + wave);
  ctx.fillRect(8, 10, 4, 3 - wave);
  ctx.fillRect(5, 12, 4, 2);
  /* Eyes */
  ctx.fillStyle = C2;
  ctx.fillRect(3, 4, 3, 3);
  ctx.fillRect(8, 4, 3, 3);
  ctx.fillStyle = PAL.STONE_DARK;
  ctx.fillRect(4, 5, 2, 2);
  ctx.fillRect(9, 5, 2, 2);
  ctx.globalAlpha = 1;
}