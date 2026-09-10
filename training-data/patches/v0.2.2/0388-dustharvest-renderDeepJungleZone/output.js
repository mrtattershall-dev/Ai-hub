function renderDeepJungleZone() {
  if (!gameState.inDeepJungle) return;
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width / ZOOM, H = canvas.height / ZOOM;
  const cx = player.x - W / 2, cy = player.y - H / 2;
  const now = Date.now();

  ctx.save();
  ctx.scale(ZOOM, ZOOM);

  // Background — deep, oppressive dark
  ctx.fillStyle = '#04080400';
  const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H) * 0.8);
  bgGrad.addColorStop(0, '#060c08');
  bgGrad.addColorStop(1, '#020402');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Tile pass
  const tx0 = Math.max(0, Math.floor(cx / DJ_T));
  const ty0 = Math.max(0, Math.floor(cy / DJ_T));
  const tx1 = Math.min(DJ_W - 1, Math.ceil((cx + W) / DJ_T));
  const ty1 = Math.min(DJ_H - 1, Math.ceil((cy + H) / DJ_T));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredDeep[ty * DJ_W + tx]) continue;
      const t = getDJT(tx, ty);
      const sx = tx * DJ_T - cx, sy = ty * DJ_T - cy;
      _drawDeepJGTile(t, sx, sy, ctx, now);
    }
  }

  // Fog overlay
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredDeep[ty * DJ_W + tx]) {
        ctx.fillRect(tx * DJ_T - cx, ty * DJ_T - cy, DJ_T + 1, DJ_T + 1);
      }
    }
  }

  // ── Formation ambient glow pass ───────────────────────────────────────────
  // The formation radiates a soft golden light in all directions.
  // We do a second pass drawing radial glows over explored formation tiles.
  const formPulse = 0.4 + 0.3 * Math.sin(now * 0.0008);
  ctx.globalCompositeOperation = 'lighter';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!exploredDeep[ty * DJ_W + tx]) continue;
      if (getDJT(tx, ty) !== JG.FORMATION && getDJT(tx, ty) !== JG.BIOLUM) continue;
      const sx = tx * DJ_T + DJ_T/2 - cx;
      const sy = ty * DJ_T + DJ_T/2 - cy;
      const isForm = getDJT(tx, ty) === JG.FORMATION;
      const r = isForm ? 64 : 28;
      const col = isForm
        ? `rgba(200, 110, 20, ${formPulse * 0.18})`
        : `rgba(20, 180, 140, ${0.3 + 0.2 * Math.sin(now * 0.0015 + tx + ty) * 0.12})`;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      glow.addColorStop(0, col);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // ── Biolum ground fog ─────────────────────────────────────────────────────
  // A soft cyan haze drifts across the deep zone floor
  if (player.y / DJ_T > 36) {
    const fogDrift = Math.sin(now * 0.0003) * 8;
    const fogGrad = ctx.createLinearGradient(0, H * 0.7, 0, H);
    const deepFactor = Math.min(1, (player.y / DJ_T - 36) / 19);
    fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fogGrad.addColorStop(1, `rgba(10, 40, 30, ${0.18 * deepFactor})`);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(fogDrift, 0, W, H);
  }

  // Player
  drawPlayer();

  // Night / depth overlay
  const depthFactor = Math.min(1, (player.y / DJ_T - 13) / 42);
  ctx.fillStyle = `rgba(0, 3, 2, ${0.25 * depthFactor})`;
  ctx.fillRect(0, 0, W, H);

  // Zone label
  const zone = player.y / DJ_T < 13 ? 'CANOPY DESCENT'
             : player.y / DJ_T < 36 ? 'JUNGLE MID'
             : 'DEEP JUNGLE';
  ctx.fillStyle = 'rgba(80, 160, 100, 0.4)';
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(zone, W/2, H - 4);

  ctx.restore();
  if (minimapVisible) _renderDeepMinimap();
}