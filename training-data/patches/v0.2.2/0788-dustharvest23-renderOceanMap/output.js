function renderOceanMap() {
  // Coastal sky — bluer than overworld, slightly hazy
  ctx.fillStyle='#5880a8'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Horizon warmth
  const hg=ctx.createLinearGradient(0,0,0,canvas.height*0.4);
  hg.addColorStop(0,'rgba(240,180,80,.09)');
  hg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=hg; ctx.fillRect(0,0,canvas.width,canvas.height*0.4);

  ctx.save();
  ctx.scale(ZOOM,ZOOM);
  const cx=gameState.camera.x, cy=gameState.camera.y;
  const x0=Math.max(0,Math.floor(cx/OC_T));
  const y0=Math.max(0,Math.floor(cy/OC_T));
  const x1=Math.min(OC_W,x0+Math.ceil(canvas.width/ZOOM/OC_T)+2);
  const y1=Math.min(OC_H,y0+Math.ceil(canvas.height/ZOOM/OC_T)+2);

  // Tiles
  for(let ty=y0;ty<y1;ty++) for(let tx=x0;tx<x1;tx++) {
    drawOCTile(getOCT(tx,ty), tx, ty, tx*OC_T-cx, ty*OC_T-cy);
  }

  // Boat (drawn above tiles, below fog) — skipped when player is aboard
  // (in that case the boat is drawn as part of drawPlayer to keep z-order right)
  if (!player._onBoat) drawOceanBoat(cx, cy);

  // Fog
  for(let ty=y0;ty<y1;ty++) for(let tx=x0;tx<x1;tx++) {
    if(exploredOcean[ty*OC_W+tx]) continue;
    drawFogTile(tx*OC_T-cx, ty*OC_T-cy, tx*73856093^ty*19349663);
  }

  // Night campfire glow
  if(gameState.isNight||gameState.timeOfDay/60>=19||gameState.timeOfDay/60<6){
    const h24=gameState.timeOfDay/60;
    const na=h24>=20?Math.min(.8,(h24-20)/2*.8):h24<6?.8-Math.min(.8,(h24/6)*.8):0.2;
    for(let ty=y0;ty<y1;ty++) for(let tx=x0;tx<x1;tx++){
      if(!exploredOcean[ty*OC_W+tx]||getOCT(tx,ty)!==OC.FIRE) continue;
      const fx=tx*OC_T+OC_T/2-cx, fy=ty*OC_T+OC_T/2-cy;
      const fl=0.6+0.4*Math.sin(Date.now()*.004+tx*1.3+ty*2.1);
      const g=ctx.createRadialGradient(fx,fy,0,fx,fy,OC_T*3);
      g.addColorStop(0,`rgba(230,120,20,${0.24*fl*na})`);
      g.addColorStop(0.5,`rgba(180,70,10,${0.11*fl*na})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(fx-OC_T*3,fy-OC_T*3,OC_T*6,OC_T*6);
    }
  }

  // NPCs
  OC_NPCS.forEach(npc=>{
    const sx=npc.tx*OC_T+OC_T/2-cx, sy=npc.ty*OC_T+OC_T/2-cy;
    if(sx<-60||sx>canvas.width/ZOOM+60||sy<-60||sy>canvas.height/ZOOM+60) return;
    if(!exploredOcean[npc.ty*OC_W+npc.tx]) return;
    drawDockmasterNPC(npc, sx, sy);
  });

  // Enemies, player, particles
  drawEnemies(cx, cy);
  drawPlayer();
  drawAttackArc(cx, cy);
  drawParticles(cx, cy);

  // West exit prompt
  if(player.x<OC_T*4){
    const al=Math.min(1,(OC_T*4-player.x)/(3*OC_T));
    ctx.save(); ctx.globalAlpha=al*0.8;
    ctx.fillStyle='#c8b880'; ctx.font='bold 11px sans-serif'; ctx.textAlign='left';
    ctx.fillText('◄ RETURN TO FRONTIER', 10, canvas.height/ZOOM/2);
    ctx.restore();
  }

  // Boat prompt — near current boat position
  if(hasBoat() && !player._onBoat){
    const bDist=Math.hypot(player.x-gameState.boatX, player.y-gameState.boatY);
    if(bDist<OC_T*5){
      const tier=getBoatTier();
      ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      const bx=gameState.boatX-cx, by=gameState.boatY-cy-30;
      ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillText(`${tier.icon} ${tier.name}`,bx+1,by-4);
      ctx.fillStyle='#d0c888'; ctx.fillText(`${tier.icon} ${tier.name}`,bx,by-5);
    }
  } else if(!hasBoat()){
    // Empty slip marker at default slip position
    const slipDist=Math.hypot(player.x-gameState.boatX, player.y-gameState.boatY);
    if(slipDist<OC_T*4){
      const pulse=0.5+0.4*Math.sin(Date.now()*.003);
      const bx=gameState.boatX-cx, by=gameState.boatY-cy-20;
      ctx.globalAlpha=pulse;
      ctx.fillStyle='rgba(0,0,0,.4)'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('[ Boat slip — empty ]',bx+1,by-4);
      ctx.fillStyle='rgba(80,160,220,.8)'; ctx.fillText('[ Boat slip — empty ]',bx,by-5);
      ctx.globalAlpha=1;
    }
  }

  // Zone label
  ctx.font='bold 13px serif'; ctx.textAlign='center';
  const lx=canvas.width/ZOOM/2, ly=30;
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillText('— THE DOCK —',lx+1,ly+1);
  ctx.fillStyle='rgba(60,150,210,.55)'; ctx.fillText('— THE DOCK —',lx,ly);

  ctx.restore();
  if(minimapVisible) renderOceanMinimap();
}