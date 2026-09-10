function _drawPendulum(ctx, e) {
  /* Draw arm from anchor to bob in screen space */
  const asx = (e.anchorX - Camera.x) | 0;
  const asy = (e.anchorY - Camera.y) | 0;
  const bsx = (e.x + e.w * 0.5 - Camera.x) | 0;
  const bsy = (e.y - Camera.y) | 0;

  /* Arm — 1px chain segments */
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const cx = (asx + (bsx - asx) * t) | 0;
    const cy = (asy + (bsy - asy) * t) | 0;
    ctx.fillStyle = i % 2 === 0 ? PAL.STONE_MID : PAL.STONE_DARK;
    ctx.fillRect(cx, cy, 1, 2);
  }
  /* Bob — spiked iron weight */
  ctx.fillStyle = PAL.STONE_DARK;
  ctx.fillRect(bsx - 4, bsy, 8, 8);
  ctx.fillStyle = PAL.STONE_MID;
  ctx.fillRect(bsx - 3, bsy + 1, 6, 5);
  /* Spike tips — 4 cardinal spikes */
  ctx.fillStyle = PAL.STONE_HIGH;
  ctx.fillRect(bsx - 5, bsy + 3, 2, 2);   /* left */
  ctx.fillRect(bsx + 3, bsy + 3, 2, 2);   /* right */
  ctx.fillRect(bsx - 1, bsy - 2, 2, 2);   /* top */
  ctx.fillRect(bsx - 1, bsy + 7, 2, 2);   /* bottom */
}