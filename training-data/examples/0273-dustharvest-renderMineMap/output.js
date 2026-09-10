function renderMineMap() {
  const floor = gameState.mineFloor;
  const cfg = MINE_FLOOR_CFG[floor];
  ctx.fillStyle = cfg.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  const cx=gameState.camera.x, cy=gameState.camera.y;
  const stx=Math.max(0,Math.floor(cx/T)), etx=Math.min(MINE_W-1,Math.floor((cx+canvas.width/ZOOM)/T)+1);
  const sty=Math.max(0,Math.floor(cy/T)), ety=Math.min(MINE_H-1,Math.floor((cy+canvas.height/ZOOM)/T)+1);
  ctx.save();
  for (let ty2=sty;ty2<=ety;ty2++) for (let tx2=stx;tx2<=etx;tx2++) {
    const sx=tx2*T-cx, sy=ty2*T-cy;
    const t = getMineT(floor, tx2, ty2);
    drawMineTile(t, sx, sy);
  }
  ctx.restore();

  // Mine fog of war overlay — darker underground
  const mfl = gameState.mineFloor;
  for (let ty2b=sty;ty2b<=ety;ty2b++) {
    for (let tx2b=stx;tx2b<=etx;tx2b++) {
      if (isMineExplored(mfl, tx2b, ty2b)) continue;
      const sx=tx2b*T-cx, sy=ty2b*T-cy;
      drawFogTile(sx, sy, tx2b * 73856093 ^ ty2b * 19349663);
      // Extra dark overlay underground
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx, sy, T, T);
    }
  }

  drawPlayer();
  drawParticles(cx, cy);

  // Draw depleted markers for mine nodes
  ctx.save();
  const nodes = mineResourceNodes[floor];
  for (const key in nodes) {
    const n = nodes[key];
    if (!n.depleted) continue;
    const sx = n.x*T+T/2 - cx, sy = n.y*T+T/2 - cy;
    if (sx<-T||sx>canvas.width+T||sy<-T||sy>canvas.height+T) continue;
    ctx.globalAlpha=.4; ctx.fillStyle='#c06020';
    ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕', sx, sy+4);
    ctx.globalAlpha=1;
  }
  ctx.restore(); // end darkness overlay save
  ctx.restore(); // end ZOOM scale

  // ── Hazard warning indicator ───────────────────────────────────────────────
  if (_mineHazard) {
    const hsx = _mineHazard.x*T+T/2 - cx;
    const hsy = _mineHazard.y*T+T/2 - cy;
    if (hsx>-60&&hsx<canvas.width+60&&hsy>-60&&hsy<canvas.height+60) {
      const pulse = 0.5+Math.sin(Date.now()*.008)*0.4;
      ctx.save();
      ctx.globalAlpha = pulse * 0.75;
      ctx.strokeStyle = _mineHazard.type==='cavein' ? '#e06030' : '#c0c020';
      ctx.lineWidth = 3;
      ctx.setLineDash([6,4]);
      ctx.beginPath();
      ctx.arc(hsx, hsy, 28+Math.sin(Date.now()*.006)*5, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '18px serif'; ctx.textAlign = 'center';
      ctx.fillStyle = _mineHazard.type==='cavein' ? '#ff6030' : '#e0c030';
      ctx.fillText(MINE_HAZARDS[_mineHazard.type]?.icon || '⚠', hsx, hsy+6);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // Countdown bar at top of screen
    const pct = Math.max(0, _mineHazard.countdown / _mineHazard.maxCountdown);
    ctx.save();
    ctx.fillStyle = 'rgba(200,60,30,.85)';
    ctx.fillRect(0, 0, canvas.width * (1-pct), 5);
    ctx.restore();
  }

  // ── Darkness vignette (visibility degrades on deeper floors) ──────────────
  const vis = getMineVisibility();
  if (vis < 1) {
    const px2 = player.x - cx, py2 = player.y - cy;
    const radius = vis * Math.max(canvas.width, canvas.height) * 0.55;
    const grad = ctx.createRadialGradient(px2, py2, radius*0.38, px2, py2, radius*1.1);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.92-(vis*0.92)})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Warm torch flicker at close range
    if (vis < 0.75) {
      const flicker = (Math.sin(Date.now()*.007)+Math.sin(Date.now()*.013))*0.03;
      const innerGrad = ctx.createRadialGradient(px2, py2, 0, px2, py2, radius*0.55+flicker*50);
      innerGrad.addColorStop(0, 'rgba(200,120,20,0.12)');
      innerGrad.addColorStop(1, 'rgba(200,120,20,0)');
      ctx.fillStyle = innerGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  }

  // ── Rumble screen shake + red tint ─────────────────────────────────────────
  if (_mineRumbleFlash > 0.3) {
    const shakeX = (Math.random()-.5)*4*_mineRumbleFlash;
    const shakeY = (Math.random()-.5)*4*_mineRumbleFlash;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = `rgba(180,40,20,${_mineRumbleFlash*0.15})`;
    ctx.fillRect(-10, -10, canvas.width+20, canvas.height+20);
    ctx.restore();
  }

  ctx.restore();
  // Floor label + status messages
  ctx.save();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(cfg.name, canvas.width/2+1, 22);
  ctx.fillStyle = 'rgba(140,160,200,.7)'; ctx.fillText(cfg.name, canvas.width/2, 21);
  if (!isMineOpen()) {
    ctx.fillStyle = 'rgba(200,60,60,.8)';
    ctx.fillText('⚠ MINE CLOSES SOON — RETURN TO EXIT', canvas.width/2, 38);
  }
  if (vis < 0.75 && !purchasedUpgrades.has('mine_lantern')) {
    ctx.fillStyle = 'rgba(200,160,40,.7)';
    ctx.fillText("🔦 Very dark — buy Miner's Lantern for full visibility!", canvas.width/2, 38);
  }
  ctx.restore();
  if (minimapVisible) renderMinimap();
}