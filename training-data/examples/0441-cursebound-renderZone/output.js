function renderZone(ctx, zoneId, camX, camY) {
  const zone = ZONES[zoneId];
  if (!zone) return;

  if (!zone.staticCanvas) buildZoneStaticCanvas(zoneId);

  /* Zone has no map data yet — show a placeholder rather than crash */
  if (!zone.staticCanvas) {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, NES.W, NES.H);
    drawPxText(ctx, '[ ' + zoneId + ' ]', NES.W / 2, NES.H / 2 - 8, 1, PAL.STONE_HIGH, 'center');
    drawPxText(ctx, 'COMING IN NEXT SECTION',  NES.W / 2, NES.H / 2 + 8, 1, PAL.MIDGRAY,    'center');
    return;
  }

  ctx.drawImage(zone.staticCanvas, -camX, -camY);
  drawDynamicPickups(ctx, zoneId, camX, camY);
}