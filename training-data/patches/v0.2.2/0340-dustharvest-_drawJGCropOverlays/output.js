function _drawJGCropOverlays() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width / ZOOM, H = canvas.height / ZOOM;
  const cx = player.x - W / 2, cy = player.y - H / 2;

  ctx.save();
  ctx.scale(ZOOM, ZOOM);

  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled) continue;
    const [ktx, kty] = key.split(',').map(Number);
    if (!exploredJungle[kty * JG_W + ktx]) continue;

    const sx = ktx * JG_T - cx, sy = kty * JG_T - cy;
    if (sx < -JG_T || sx > W + JG_T || sy < -JG_T || sy > H + JG_T) continue;

    // Tilled plot base colour by soil tier
    const tierColors = { stripped: '#3c2c1a', recovering: '#4a3820', restored: '#3a3010' };
    ctx.fillStyle = p.watered || p.wateredToday ? '#2a3c1a' : (tierColors[p.soilTier] || '#3c2c1a');
    ctx.fillRect(sx, sy, JG_T, JG_T);

    // Soil tier indicator dot (top-left corner)
    const dotColors = { stripped: '#c07030', recovering: '#c0b050', restored: '#70c050' };
    ctx.fillStyle = dotColors[p.soilTier] || '#c07030';
    ctx.fillRect(sx + 2, sy + 2, 4, 4);

    if (!p.crop) continue;
    const cropDef = CROPS[p.crop];
    if (!cropDef) continue;

    // Growth visual: fill bar from bottom
    const pct = p.growthProgress;
    const barH = Math.floor(pct * JG_T);
    ctx.fillStyle = p.wilted ? 'rgba(150,80,20,.35)' : `rgba(60,180,40,${0.18 + pct * 0.22})`;
    ctx.fillRect(sx, sy + JG_T - barH, JG_T, barH);

    // Crop icon — centred, scale with growth
    const fontSize = p.harvestReady ? 14 : Math.max(8, Math.floor(pct * 14));
    ctx.font = fontSize + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = p.wilted ? 0.45 : 0.85;
    ctx.fillText(cropDef.icon, sx + JG_T / 2, sy + JG_T / 2);
    ctx.globalAlpha = 1;

    // Ready flash
    if (p.harvestReady) {
      const flash = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() * 0.003));
      ctx.strokeStyle = `rgba(240,220,60,${flash * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 1, sy + 1, JG_T - 2, JG_T - 2);
    }

    // Darkroot night glow
    if (p.crop === 'darkroot' && gameState.isNight) {
      const glow = 0.3 + 0.2 * Math.abs(Math.sin(Date.now() * 0.0015));
      ctx.fillStyle = `rgba(80,40,180,${glow})`;
      ctx.fillRect(sx, sy, JG_T, JG_T);
    }
  }

  ctx.restore();
}