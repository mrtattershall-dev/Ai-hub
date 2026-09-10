function buildZoneStaticCanvas(zoneId) {
  const zone = ZONES[zoneId];
  if (!zone || !zone.mapData) return;
  const { cols, rows } = zone.mapData;
  const pw = cols * NES.TILE;
  const ph = rows * NES.TILE;

  const { canvas, ctx } = createOffscreenCanvas(pw, ph);
  const zp = zonePal(zoneId);

  /* Fill background */
  ctx.fillStyle = zp.bg;
  ctx.fillRect(0, 0, pw, ph);

  /* Draw all static tiles */
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const id = zone.mapData.data[ty * cols + tx];
      if (id === T.AIR || id === T.LORE || id === T.WEAPON) continue;
      drawTile(ctx, id, tx * NES.TILE, ty * NES.TILE, tx, ty, zp);
    }
  }

  /* Zone-specific atmospheric decorations baked into the static layer */
  if (zoneId === ZONE_ID.ENTRY) drawEntryDecorations(ctx, cols);

  zone.staticCanvas = canvas;
  if (DEBUG) console.log(`[zone] static canvas built: ${zoneId} (${pw}×${ph})`);
}