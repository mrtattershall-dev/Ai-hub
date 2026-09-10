function drawNESPanel(ctx, x, y, w, h, opts) {
  const bg      = opts.bg      || PAL.HUD_BG;
  const border  = opts.border  || PAL.STONE_HIGH;
  const hi      = opts.hi      || PAL.WHITE;
  const corners = opts.corners !== false;

  /* Fill */
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  /* Outer border — 2px thick */
  ctx.fillStyle = border;
  ctx.fillRect(x,         y,         w,  2);   /* top    */
  ctx.fillRect(x,         y+h-2,     w,  2);   /* bottom */
  ctx.fillRect(x,         y,         2,  h);   /* left   */
  ctx.fillRect(x+w-2,     y,         2,  h);   /* right  */

  /* Inner highlight — 1px inset from border */
  ctx.fillStyle = hi;
  ctx.fillRect(x+2,       y+2,       w-4,  1); /* top hi    */
  ctx.fillRect(x+2,       y+2,       1,  h-4); /* left hi   */

  /* Corner ornaments — classic NES dialog box crosses */
  if (corners) {
    const C = PAL.PALE_GOLD;
    [[x, y], [x+w-4, y], [x, y+h-4], [x+w-4, y+h-4]].forEach(([cx, cy]) => {
      ctx.fillStyle = C;
      ctx.fillRect(cx+1, cy,   2, 4);
      ctx.fillRect(cx,   cy+1, 4, 2);
    });
  }
}