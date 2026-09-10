function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (gameState.inBLMine) {
    renderBLMineMap();
    return;
  }
  if (gameState.inMine) {
    renderMineMap();
    return;
  }
  if (gameState.inBadlands) {
    renderBadlandsMap();
    return;
  }
  if (gameState.inHoboCamp) {
    renderHoboCampMap();
    return;
  }
  if (gameState.inOcean) {
    renderOceanMap();
    return;
  }
  ctx.fillStyle='#0e0c08'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  const cx=gameState.camera.x, cy=gameState.camera.y;
  const stx=Math.max(0,Math.floor(cx/T)), etx=Math.min(MAP_W-1,Math.floor((cx+canvas.width/ZOOM)/T)+1);
  const sty=Math.max(0,Math.floor(cy/T)), ety=Math.min(MAP_H-1,Math.floor((cy+canvas.height/ZOOM)/T)+1);
  for (let ty=sty;ty<=ety;ty++) for (let tx=stx;tx<=etx;tx++) {
    const sx=tx*T-cx, sy=ty*T-cy;
    drawTile(tx,ty,sx,sy);
    const k=plotKey(tx,ty);
    if (plots[k]) drawCrop(plots[k],sx,sy,tx,ty);
  }
  // Fog of war overlay — draw after tiles, before entities
  for (let ty=sty;ty<=ety;ty++) {
    for (let tx=stx;tx<=etx;tx++) {
      if (isExplored(tx, ty)) continue;
      const sx=tx*T-cx, sy=ty*T-cy;
      drawFogTile(sx, sy, tx * 73856093 ^ ty * 19349663);
    }
  }

  for (const npc of npcs) drawNPC(npc);
  drawMerchant(cx, cy);
  drawMinerNPC(cx, cy);
  drawAnimals(cx, cy);  // Phase 8: ranch
  drawEnemies(cx, cy);
  drawPlayer();
  drawAttackArc(cx, cy);
  ctx.font='bold 13px serif'; ctx.textAlign='center';
  for (const z of ZONE_LABELS) {
    const sx=z.x-cx, sy=z.y-cy;
    if(sx<-120||sx>canvas.width+120||sy<-40||sy>canvas.height+40) continue;
    ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillText(z.l,sx+1,sy+1);
    ctx.fillStyle=z.c; ctx.fillText(z.l,sx,sy);
  }
  // Left-edge Badlands hint arrow
  if (player.x < 8*T) {
    const edgeSX = Math.max(0, -cx)+8;
    const midSY  = canvas.height/2;
    const alpha  = Math.min(1, (8*T - player.x)/(6*T));
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.4*Math.abs(Math.sin(Date.now()*.002)) * alpha;
    ctx.font='bold 11px sans-serif'; ctx.textAlign='left';
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText('◄ THE BADLANDS', edgeSX+2, midSY+1);
    ctx.fillStyle='#e08030';        ctx.fillText('◄ THE BADLANDS', edgeSX,   midSY);
    ctx.restore();
  }
  // North-edge Hobo Camp hint arrow — shows when near town north sector
  if (player.y < 8*T && player.x > 40*T && player.x < 65*T) {
    const midSX = canvas.width/2;
    const edgeSY = Math.max(0, -cy)+14;
    const alpha  = Math.min(1, (8*T - player.y)/(6*T));
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.4*Math.abs(Math.sin(Date.now()*.002)) * alpha;
    ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText('▲ HOBO CAMP', midSX+1, edgeSY+1);
    ctx.fillStyle='#a8c85c';        ctx.fillText('▲ HOBO CAMP', midSX,   edgeSY);
    ctx.restore();
  }
  // East-edge Ocean hint arrow — shows when near east edge mid-map
  if (player.x > (MAP_W-10)*T && player.y > 28*T && player.y < 44*T) {
    const edgeSX = Math.min(canvas.width/ZOOM, MAP_W*T-cx) - 16;
    const midSY  = canvas.height/ZOOM/2;
    const alpha  = Math.min(1, (player.x - (MAP_W-10)*T)/(8*T));
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.4*Math.abs(Math.sin(Date.now()*.002)) * alpha;
    ctx.font='bold 11px sans-serif'; ctx.textAlign='right';
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText('THE DOCK ►', edgeSX+1, midSY+1);
    ctx.fillStyle='#4899d8';        ctx.fillText('THE DOCK ►', edgeSX,   midSY);
    ctx.restore();
  }
  drawParticles(cx,cy);
  drawNodeIndicators(cx,cy);

  // ── Seasonal ambient tint ───────────────────────────────────────────────────
  // A subtle full-viewport color wash rendered inside the ZOOM scale so it
  // perfectly covers the tile area without bleeding outside.
  {
    const s = getCurrentSeason();
    if (s.ambientTint) {
      ctx.save();
      ctx.fillStyle = s.ambientTint;
      ctx.fillRect(cx - T, cy - T, (MAP_W + 2) * T, (MAP_H + 2) * T);
      ctx.restore();
    }
    // Snow — tiny white specks that drift down slowly, winter only
    if (s.snowAlpha > 0 && !gameState.isNight) {
      const now = Date.now();
      ctx.save();
      ctx.globalAlpha = s.snowAlpha;
      ctx.fillStyle = '#e8eeff';
      // Use deterministic pseudo-random per-flake so they don't teleport on re-render
      const viewW = canvas.width / ZOOM, viewH = canvas.height / ZOOM;
      const FLAKES = 48;
      for (let f = 0; f < FLAKES; f++) {
        const seed = f * 7919;
        const xFrac = ((seed * 2654435761) >>> 0) / 0xFFFFFFFF;
        const yOff  = ((seed * 2246822519) >>> 0) / 0xFFFFFFFF;
        const speed = 18 + (((seed * 1597334677) >>> 0) / 0xFFFFFFFF) * 22; // 18-40 px/s
        const size  = 1 + (((seed * 3266489917) >>> 0) / 0xFFFFFFFF) * 2;
        const drift = Math.sin(now * 0.0004 + f * 0.7) * 14;
        const fx = (xFrac * viewW + cx + drift) % viewW;
        const fy = ((yOff * viewH + (now * speed / 1000)) % viewH);
        ctx.beginPath();
        ctx.arc(cx + fx, cy + fy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Storm — rendered inside ZOOM scale, same as snow
    if (gameState._stormIntensity > 0) renderStorm(cx, cy);
  }

  ctx.restore(); // end ZOOM scale
  // Phase 8 — minimap
  if (minimapVisible) renderMinimap();
}