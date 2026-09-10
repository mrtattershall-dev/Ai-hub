function _drawGearGolem(ctx, e) {
  const f  = e.hurtTimer > 0 && (e.hurtTimer % 4) < 2;
  const C1 = f ? PAL.WHITE : PAL.STONE_MID;
  const C2 = f ? PAL.WHITE : PAL.STONE_HIGH;
  const C3 = f ? PAL.WHITE : PAL.GOLD;
  const spinAngle = ((e.spinTimer || 0) * 0.05) % (Math.PI * 2);

  /* Gear head — rotated gear */
  ctx.save();
  ctx.translate(7, 7);
  ctx.rotate(spinAngle);
  ctx.fillStyle = C1;
  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2;
    ctx.fillRect(
      (Math.cos(a) * 7 - 2) | 0,
      (Math.sin(a) * 7 - 2) | 0,
      4, 4
    );
  }
  ctx.restore();
  ctx.fillStyle = C2;
  ctx.fillRect(4, 4, 6, 6);    /* gear center */
  ctx.fillStyle = C3;
  ctx.fillRect(5, 5, 4, 4);    /* core glint */

  /* Heavy body */
  ctx.fillStyle = C1;
  ctx.fillRect(0, 13, 14, 8);
  ctx.fillStyle = C2;
  ctx.fillRect(2, 14, 10, 5);
  ctx.fillStyle = C3;
  ctx.fillRect(5, 15, 4, 3);   /* power unit */

  /* Legs — slower gait */
  const l = e.animFrame % 2 === 0 ? 1 : -1;
  ctx.fillStyle = C1;
  ctx.fillRect(1,  20 - l, 5, 3);
  ctx.fillRect(8,  20 + l, 5, 3);
}