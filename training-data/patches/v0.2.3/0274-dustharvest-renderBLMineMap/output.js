function renderBLMineMap() {
  const floor = gameState.blMineFloor;
  const cfg = BL_MINE_FLOOR_CFG[floor];
  ctx.fillStyle = cfg.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  const cx=gameState.camera.x, cy=gameState.camera.y;
  const stx=Math.max(0,Math.floor(cx/T)), etx=Math.min(MINE_W-1,Math.floor((cx+canvas.width/ZOOM)/T)+1);
  const sty=Math.max(0,Math.floor(cy/T)), ety=Math.min(MINE_H-1,Math.floor((cy+canvas.height/ZOOM)/T)+1);
  ctx.save();
  for (let ty2=sty;ty2<=ety;ty2++) for (let tx2=stx;tx2<=etx;tx2++) {
    const sx=tx2*T-cx, sy=ty2*T-cy;
    drawMineTile(getBLMineT(floor,tx2,ty2), sx, sy);
  }
  ctx.restore();
  // Fog of war
  for (let ty2=sty;ty2<=ety;ty2++) {
    for (let tx2=stx;tx2<=etx;tx2++) {
      if (isBLMineExplored(floor,tx2,ty2)) continue;
      const sx=tx2*T-cx, sy=ty2*T-cy;
      drawFogTile(sx,sy,tx2*73856093^ty2*19349663);
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(sx,sy,T,T);
    }
  }
  drawPlayer();
  drawParticles(cx,cy);
  // Draw BL mine NPCs
  drawBLMineNPCs(cx, cy);
  // Depleted markers
  ctx.save();
  const nodes = blMineResourceNodes[floor];
  for (const key in nodes) {
    const n = nodes[key];
    if (!n.depleted) continue;
    const sx=n.x*T+T/2-cx, sy=n.y*T+T/2-cy;
    if (sx<-T||sx>canvas.width+T||sy<-T||sy>canvas.height+T) continue;
    ctx.globalAlpha=.4; ctx.fillStyle='#c06020';
    ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕',sx,sy+4); ctx.globalAlpha=1;
  }
  ctx.restore();
  ctx.restore();
  // Dynamic vignette — deeper floors are darker, the company mine has a cold blue tint
  const visib = cfg.visibility;
  const vignW = canvas.width, vignH = canvas.height;
  const grad = ctx.createRadialGradient(vignW/2,vignH/2,vignW*visib*0.32,vignW/2,vignH/2,vignW*0.88);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,`rgba(0,0,0,${0.92-visib*0.55})`);
  ctx.fillStyle=grad; ctx.fillRect(0,0,vignW,vignH);
  // Cold blue-green ambient tint — company industrial, something wrong down here
  const fl2 = gameState.blMineFloor;
  if (fl2 >= 2) {
    const tintAlpha = 0.04 + fl2 * 0.025;
    ctx.fillStyle = `rgba(20,40,60,${tintAlpha})`;
    ctx.fillRect(0,0,vignW,vignH);
  }
  if (minimapVisible) renderMinimap();
}