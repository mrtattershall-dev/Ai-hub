function renderStorm(cx, cy) {
  const intensity = gameState._stormIntensity || 0;
  if (intensity <= 0) return;
  const now = Date.now();
  const viewW = canvas.width / ZOOM, viewH = canvas.height / ZOOM;

  _bakeStormCanvas(viewW, viewH, intensity);

  ctx.save();

  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(200,140,40,${(intensity * 0.38).toFixed(2)})`;
  ctx.fillRect(cx, cy, viewW, viewH);

  // FIX: scrollX wraps over ocW (=W), but canvas is W*2, so use W*2 as the wrap period
  const scrollPeriod = _storm.ocW * 2;
  const scrollX = (now * 0.18) % scrollPeriod;
  const scrollY = Math.sin(now * 0.0002) * 8;
  // Draw the canvas so it tiles: offset by -scrollX, then +scrollPeriod for the wrap copy
  ctx.drawImage(_storm.oc, cx - scrollX,              cy + scrollY);
  ctx.drawImage(_storm.oc, cx - scrollX + scrollPeriod, cy + scrollY);

  ctx.globalAlpha = intensity * 0.28;
  ctx.fillStyle = '#3c1e00';
  const vd = Math.min(viewW, viewH) * 0.3;
  ctx.fillRect(cx,          cy,          viewW, vd);
  ctx.fillRect(cx,          cy+viewH-vd, viewW, vd);
  ctx.fillRect(cx,          cy,          vd,    viewH);
  ctx.fillRect(cx+viewW-vd, cy,          vd,    viewH);

  ctx.restore();
}