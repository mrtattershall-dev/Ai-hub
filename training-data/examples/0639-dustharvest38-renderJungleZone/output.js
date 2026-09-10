function renderJungleZone() {
  if (!gameState.inJungle) return;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width / ZOOM, H = canvas.height / ZOOM;
  const cx = player.x - W / 2, cy = player.y - H / 2;

  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  ctx.fillStyle = '#0a1a08';
  ctx.fillRect(0, 0, W, H);

  // Tiles
  const tx0 = Math.max(0, Math.floor(cx / JG_T));
  const ty0 = Math.max(0, Math.floor(cy / JG_T));
  const tx1 = Math.min(JG_W - 1, Math.ceil((cx + W) / JG_T));
  const ty1 = Math.min(JG_H - 1, Math.ceil((cy + H) / JG_T));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const fog = exploredJungle[ty * JG_W + tx];
      if (!fog) continue;
      const t = getJGT(tx, ty);
      const sx = tx * JG_T - cx, sy = ty * JG_T - cy;
      drawJGTile(t, sx, sy);
      if (fog === 1) {
        // Semi-transparent fog-of-war on just-explored tiles (optional)
      }
    }
  }

  // Fog overlay — unexplored cells
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredJungle[ty * JG_W + tx]) {
        const sx = tx * JG_T - cx, sy = ty * JG_T - cy;
        ctx.fillRect(sx, sy, JG_T + 1, JG_T + 1);
      }
    }
  }

  // NPCs
  JG_NPCS.forEach(npc => {
    if (!exploredJungle[npc.ty * JG_W + npc.tx]) return;
    const sx = npc.tx * JG_T + JG_T / 2 - cx;
    const sy = npc.ty * JG_T + JG_T / 2 - cy;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return;
    _drawJGNPC(npc, sx, sy, ctx);
  });

  // Player
  drawPlayer();

  // Night overlay handled by _patchJungleNightOverlay (visual polish patch)

  ctx.restore();
  if (minimapVisible) renderJungleMinimap();
}