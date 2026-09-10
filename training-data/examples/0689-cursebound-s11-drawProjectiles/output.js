function drawProjectiles(ctx) {
  for (const pr of projectiles) {
    const sx = (pr.x - Camera.x) | 0;
    const sy = (pr.y - Camera.y) | 0;

    ctx.save();
    if (pr.type === 'axe') {
      ctx.translate(sx + 5, sy + 5);
      ctx.rotate(pr.rotation || 0);
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(-4, -1, 8, 2);    /* axe shaft */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(-1, -4, 2, 8);    /* axe head vertical */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(-1, -4, 2, 2);    /* glint */
    } else {
      /* Dagger */
      ctx.fillStyle = PAL.CLOAK_LITE;
      ctx.fillRect(sx, sy, 6, 2);    /* blade */
      ctx.fillStyle = PAL.STONE_HIGH;
      ctx.fillRect(sx + 6, sy - 1, 2, 4);  /* handle guard */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(sx, sy, 1, 1);    /* tip glint */
    }
    ctx.restore();
  }
}