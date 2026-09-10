function renderZone(ctx, zoneId, camX, camY) {
  const zone = ZONES[zoneId];
  if (!zone) return;

  if (!zone.staticCanvas) buildZoneStaticCanvas(zoneId);

  /* Zone has no map data yet — show a placeholder rather than crash */
  if (!zone.staticCanvas) {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, NES.W, NES.H);
    ctx.fillStyle = PAL.STONE_HIGH;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ ' + zoneId + ' ]', NES.W / 2, NES.H / 2 - 8);
    ctx.fillStyle = PAL.MIDGRAY;
    ctx.font = '6px monospace';
    ctx.fillText('COMING IN NEXT SECTION', NES.W / 2, NES.H / 2 + 8);
    ctx.textAlign = 'left';
    return;
  }

  ctx.drawImage(zone.staticCanvas, -camX, -camY);
  drawDynamicPickups(ctx, zoneId, camX, camY);
}