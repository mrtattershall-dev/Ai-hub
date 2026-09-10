function drawEnemies(ctx) {
  const zone = ZONES[G.currentZoneId];
  if (!zone || !zone.enemies || zone.enemies.length === 0) return;

  for (const e of zone.enemies) {
    if (e.dead) continue;
    const sx = (e.x - Camera.x) | 0;
    const sy = (e.y - Camera.y) | 0;
    if (sx + e.w < 0 || sx > NES.W || sy + e.h < 0 || sy > NES.H) continue;

    /* Death flicker — skip alternate 3-frame bursts */
    if (e.state === 'dead' && (e.stateTimer % 6) < 3) continue;

    ctx.save();
    if (e.facing === -1) {
      ctx.translate(sx + e.w, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }

    switch (e.type) {
      case 'skeleton':      _drawSkeleton(ctx, e);      break;
      case 'bat':           _drawBat(ctx, e);           break;
      case 'armored_guard': _drawArmoredGuard(ctx, e);  break;
    }
    ctx.restore();
  }
}