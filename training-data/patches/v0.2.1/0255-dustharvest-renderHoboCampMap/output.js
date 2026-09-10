function renderHoboCampMap() {
  // Sky — overcast, muted
  ctx.fillStyle='#3a3828'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(ZOOM,ZOOM);

  const cx=gameState.camera.x, cy=gameState.camera.y;
  const startX=Math.max(0,Math.floor(cx/HC_T));
  const startY=Math.max(0,Math.floor(cy/HC_T));
  const endX=Math.min(HC_W,startX+Math.ceil(canvas.width/ZOOM/HC_T)+2);
  const endY=Math.min(HC_H,startY+Math.ceil(canvas.height/ZOOM/HC_T)+2);

  // ── Draw tiles ──
  for(let ty=startY;ty<endY;ty++){
    for(let tx=startX;tx<endX;tx++){
      const t=getHCT(tx,ty);
      const sx=tx*HC_T-cx, sy=ty*HC_T-cy;
      if(t===HC.EXIT){
        ctx.fillStyle='#897762'; ctx.fillRect(sx,sy,HC_T,HC_T);
        ctx.fillStyle='#a38762'; ctx.fillRect(sx,sy,HC_T,1);
        const ep=0.5+0.4*Math.sin(Date.now()*.003+tx);
        ctx.fillStyle=`rgba(200,220,140,${ep})`;
        ctx.beginPath();
        ctx.moveTo(sx+HC_T/2,sy+HC_T-3);
        ctx.lineTo(sx+HC_T/2-4,sy+HC_T-10);
        ctx.lineTo(sx+HC_T/2+4,sy+HC_T-10);
        ctx.closePath(); ctx.fill();
      } else {
        drawHCTile(t,tx,ty,sx,sy);
      }
    }
  }

  // ── Fog of war — draw after tiles, before entities (matches overworld) ──
  for(let ty=startY;ty<endY;ty++){
    for(let tx=startX;tx<endX;tx++){
      if(exploredHobo[ty*HC_W+tx]) continue; // explored — fully visible, no fog
      const sx=tx*HC_T-cx, sy=ty*HC_T-cy;
      drawFogTile(sx, sy, tx*73856093^ty*19349663);
    }
  }

  // ── Night campfire glow pass ──
  if (gameState.isNight || gameState.timeOfDay/60 >= 19 || gameState.timeOfDay/60 < 6) {
    const h24 = gameState.timeOfDay/60;
    const na = h24>=20 ? Math.min(.8,(h24-20)/2*.8) : h24<6 ? .8-Math.min(.8,(h24/6)*.8) : 0.2;
    for(let ty=startY;ty<endY;ty++){
      for(let tx=startX;tx<endX;tx++){
        if(!exploredHobo[ty*HC_W+tx]) continue;
        if(getHCT(tx,ty)!==TL.CAMPFIRE) continue;
        const fx=tx*HC_T+HC_T/2-cx, fy=ty*HC_T+HC_T/2-cy;
        const flicker=0.6+0.4*Math.sin(Date.now()*.004+tx*1.3+ty*2.1);
        const grad=ctx.createRadialGradient(fx,fy,0,fx,fy,HC_T*2.5);
        grad.addColorStop(0,`rgba(230,120,20,${0.22*flicker*na})`);
        grad.addColorStop(0.5,`rgba(180,70,10,${0.1*flicker*na})`);
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=grad;
        ctx.fillRect(fx-HC_T*2.5,fy-HC_T*2.5,HC_T*5,HC_T*5);
      }
    }
  }

  // ── Entities ──
  HC_NPCS.forEach(npc=>{
    // Kit leaves for the jungle once her ticket is paid and the player has left
    if (npc.id === 'hc_young' && hcTalkSeen.has('kit_ticket_paid') && !gameState.inHoboCamp) return;
    // Also hide her on re-entry — once you leave after paying, she's gone
    if (npc.id === 'hc_young' && hcTalkSeen.has('kit_left_camp')) return;
    const sx=npc.tx*HC_T+HC_T/2-cx, sy=npc.ty*HC_T+HC_T/2-cy;
    if(sx<-60||sx>canvas.width/ZOOM+60||sy<-60||sy>canvas.height/ZOOM+60) return;
    if(!exploredHobo[npc.ty*HC_W+npc.tx]) return;
    drawHCNPC(npc, sx, sy);
  });

  // Enemies (bandits, wolves etc. that wander into camp at night)
  drawEnemies(cx, cy);

  // Player
  drawPlayer();
  drawAttackArc(cx, cy);

  // South exit hint
  if(player.y > (HC_H-6)*HC_T){
    const alpha=Math.min(1,(player.y-(HC_H-6)*HC_T)/(4*HC_T));
    ctx.save(); ctx.globalAlpha=alpha*0.8;
    ctx.fillStyle='#c8b880'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('▼ RETURN TO FRONTIER', canvas.width/ZOOM/2, canvas.height/ZOOM-20);
    ctx.restore();
  }

  ctx.restore();
  if(minimapVisible) renderHoboCampMinimap();
}