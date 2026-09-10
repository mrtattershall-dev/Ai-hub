function drawDynamicPickups(ctx, zoneId, camX, camY) {
  const zone = ZONES[zoneId];
  if (!zone || !zone.mapData) return;
  const { cols, rows } = zone.mapData;
  const pulse = Math.sin(G.frame * 0.1) * 0.5 + 0.5;  /* 0–1 oscillate */

  /* Only draw tiles in the visible viewport */
  const tx0 = Math.max(0,          ( camX              / NES.TILE) | 0);
  const tx1 = Math.min(cols - 1,  (((camX + NES.W)    / NES.TILE) | 0) + 1);
  const ty0 = Math.max(0,          ( camY              / NES.TILE) | 0);
  const ty1 = Math.min(rows - 1,  (((camY + NES.H)    / NES.TILE) | 0) + 1);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = zone.mapData.data[ty * cols + tx];
      if (id !== T.LORE && id !== T.WEAPON) continue;

      const px = tx * NES.TILE - camX;
      const py = ty * NES.TILE - camY;

      if (id === T.WEAPON) {
        /* Gold shimmer */
        const bright = Math.floor(pulse * 40);
        ctx.fillStyle = PAL.STONE_MID;
        ctx.fillRect(px, py, NES.TILE, NES.TILE);
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(px + 2, py + 6, NES.TILE - 4, 4);
        ctx.fillStyle = PAL.PALE_GOLD;
        ctx.fillRect(px + 4, py + 5, NES.TILE - 8, 2);
        /* shimmer pulse */
        if (bright > 20) {
          ctx.fillStyle = PAL.WHITE;
          ctx.fillRect(px + 7, py + 5, 2, 2);
        }
      }

      if (id === T.LORE) {
        /* Pulsing blue rune */
        ctx.fillStyle = PAL.STONE_MID;
        ctx.fillRect(px, py, NES.TILE, NES.TILE);
        /* diamond */
        const c = PAL.CLOAK_LITE;
        ctx.fillStyle = c;
        ctx.fillRect(px + 7, py + 2, 2, 2);
        ctx.fillRect(px + 5, py + 4, 6, 2);
        ctx.fillRect(px + 3, py + 6, 10, 2);
        ctx.fillRect(px + 5, py + 8, 6, 2);
        ctx.fillRect(px + 7, py + 10, 2, 2);
        /* pulse overlay */
        if (pulse > 0.5) {
          ctx.fillStyle = PAL.WHITE;
          ctx.fillRect(px + 7, py + 6, 2, 2);
        }
      }
    }
  }
}