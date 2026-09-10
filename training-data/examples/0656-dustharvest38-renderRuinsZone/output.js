function renderRuinsZone() {
  if (!gameState.inRuins) return;
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width / ZOOM, H = canvas.height / ZOOM;
  const cx = player.x - W/2, cy = player.y - H/2;
  const now = Date.now();

  ctx.save();
  ctx.scale(ZOOM, ZOOM);

  // Dark interior background
  ctx.fillStyle = '#080804';
  ctx.fillRect(0, 0, W, H);

  // Tile pass
  const tx0 = Math.max(0, Math.floor(cx/RU_T));
  const ty0 = Math.max(0, Math.floor(cy/RU_T));
  const tx1 = Math.min(RU_W-1, Math.ceil((cx+W)/RU_T));
  const ty1 = Math.min(RU_H-1, Math.ceil((cy+H)/RU_T));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredRuins[ty*RU_W+tx]) continue;
      const t = getRUT(tx, ty);
      const sx = tx*RU_T - cx, sy = ty*RU_T - cy;
      // Reuse the rich drawJGTile renderer — tiles share the same enum
      drawJGTile(t, sx, sy);
      // ASCEND tile highlight
      if (t === JG.ASCEND) {
        const p = 0.5+0.5*Math.sin(now*0.002);
        ctx.fillStyle = `rgba(180,220,100,${p*0.3})`;
        ctx.fillRect(sx, sy, RU_T, RU_T);
      }
    }
  }

  // Fog
  ctx.fillStyle = 'rgba(0,0,0,0.93)';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredRuins[ty*RU_W+tx]) ctx.fillRect(tx*RU_T-cx, ty*RU_T-cy, RU_T+1, RU_T+1);
    }
  }

  // Player
  drawPlayer();

  // Room label
  const rty = Math.floor(player.y/RU_T);
  const roomLabel = rty < 9 ? 'ENTRY HALL' : rty < 19 ? 'PROCESSING FLOOR' : 'ARCHIVE';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#a08060';
  ctx.font = '6px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ALTAVERDE RUINS — ' + roomLabel, W/2, H-4);
  ctx.globalAlpha = 1;

  ctx.restore();
}