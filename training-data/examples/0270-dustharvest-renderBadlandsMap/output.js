function renderBadlandsMap() {
  ctx.fillStyle='#6a3818'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  const cx=gameState.camera.x, cy=gameState.camera.y;
  const stx=Math.max(0,Math.floor(cx/T)), etx=Math.min(BL_W-1,Math.floor((cx+canvas.width/ZOOM)/T)+1);
  const sty=Math.max(0,Math.floor(cy/T)), ety=Math.min(BL_H-1,Math.floor((cy+canvas.height/ZOOM)/T)+1);

  for(let ty=sty;ty<=ety;ty++) for(let tx=stx;tx<=etx;tx++) {
    const sx=tx*T-cx, sy=ty*T-cy;
    drawBLTile(tx,ty,sx,sy);
  }
  // Fog of war
  for(let ty=sty;ty<=ety;ty++) for(let tx=stx;tx<=etx;tx++) {
    if(exploredBadlands[ty*BL_W+tx]) continue;
    drawFogTile(tx*T-cx, ty*T-cy, tx*73856093^ty*19349663);
  }

  // Draw the Fence vendor NPC sprite
  {
    const vsx = blVendorX*T+T/2-cx, vsy = blVendorY*T+T/2-cy;
    if (vsx>-T&&vsx<canvas.width+T&&vsy>-T&&vsy<canvas.height+T&&exploredBadlands[blVendorY*BL_W+blVendorX]) {
      drawFenceVendor(vsx, vsy);
      const dv = Math.hypot(player.x-(blVendorX*T+T/2), player.y-(blVendorY*T+T/2));
      if (dv < T*2.5) {
        const pulse = 0.65+Math.sin(Date.now()*.006)*0.35;
        ctx.save(); ctx.globalAlpha=pulse;
        ctx.fillStyle='#f0d060'; ctx.font='7px sans-serif'; ctx.textAlign='center';
        ctx.fillText(blTalkSeen.has('who_are_you') ? '[E] Crane' : '[E] Stranger', vsx, vsy-28);
        ctx.globalAlpha=1; ctx.restore();
      }
    }
  }

  // Draw badlands outpost feature sprites (campfire, chest, wanted board — not vendor)
  const blFeatures = [
    { x:blFireX, y:blFireY, type:'fire', label:'Rest' },
    { x:blChestX, y:blChestY, type:blChestLooted?'chest_open':'chest', label:blChestLooted?'Looted':'Chest' },
    { x:blWantedBoardX, y:blWantedBoardY, type:'board', label:'Wanted' },
    { x:blDeepChestX, y:blDeepChestY, type:blDeepChestLooted?'chest_open':'skull_chest', label:blDeepChestLooted?'Looted':'Deep Cache' },
  ];
  for (const f of blFeatures) {
    const fsx = f.x*T+T/2-cx, fsy = f.y*T+T/2-cy;
    if (fsx<-T||fsx>canvas.width+T||fsy<-T||fsy>canvas.height+T) continue;
    if (!exploredBadlands[f.y*BL_W+f.x]) continue;

    ctx.save();
    if (f.type==='fire') {
      // Campfire — stone ring + animated flame
      const ft=Date.now()*.004;
      // Stones
      ctx.fillStyle='#686060'; ctx.beginPath(); ctx.ellipse(fsx,fsy+4,9,4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#585050'; ctx.beginPath(); ctx.ellipse(fsx,fsy+4,7,3,0,0,Math.PI*2); ctx.fill();
      // Log
      ctx.fillStyle='#4a2808'; ctx.fillRect(fsx-7,fsy+2,14,3); ctx.fillRect(fsx-3,fsy,6,5);
      // Outer flame
      ctx.fillStyle=`rgba(220,100,20,${0.7+Math.sin(ft)*0.2})`;
      ctx.beginPath(); ctx.moveTo(fsx-5,fsy+2); ctx.quadraticCurveTo(fsx-6,fsy-8,fsx,fsy-14+Math.sin(ft)*2); ctx.quadraticCurveTo(fsx+6,fsy-8,fsx+5,fsy+2); ctx.closePath(); ctx.fill();
      // Inner flame
      ctx.fillStyle=`rgba(255,200,40,${0.75+Math.cos(ft*1.3)*0.2})`;
      ctx.beginPath(); ctx.moveTo(fsx-3,fsy+1); ctx.quadraticCurveTo(fsx-2,fsy-6,fsx,fsy-10+Math.sin(ft*1.4)*1.5); ctx.quadraticCurveTo(fsx+2,fsy-6,fsx+3,fsy+1); ctx.closePath(); ctx.fill();
      // Core
      ctx.fillStyle=`rgba(255,255,180,${0.6+Math.sin(ft*2)*0.3})`;
      ctx.beginPath(); ctx.ellipse(fsx,fsy-4,2,3,0,0,Math.PI*2); ctx.fill();
      // Ember glow
      ctx.globalAlpha=0.18+Math.sin(ft*0.7)*0.1;
      ctx.fillStyle='#ff6600';
      ctx.beginPath(); ctx.ellipse(fsx,fsy,11,5,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;

    } else if(f.type==='chest'||f.type==='skull_chest') {
      // Treasure chest — wooden with iron bands
      const isk=f.type==='skull_chest';
      // Shadow
      ctx.globalAlpha=0.25; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(fsx,fsy+7,9,3,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      // Body
      ctx.fillStyle=isk?'#1a0808':'#6a3a10'; ctx.fillRect(fsx-8,fsy-2,16,10);
      ctx.fillStyle=isk?'#2a1010':'#7a4a18'; ctx.fillRect(fsx-7,fsy-1,14,8);
      // Lid
      ctx.fillStyle=isk?'#200a0a':'#5a2e08'; ctx.fillRect(fsx-8,fsy-6,16,5);
      ctx.fillStyle=isk?'#301010':'#6a3a10'; ctx.fillRect(fsx-7,fsy-5,14,4);
      // Lid curve top
      ctx.fillStyle=isk?'#401212':'#7a4818'; ctx.fillRect(fsx-6,fsy-7,12,2);
      // Iron bands
      ctx.fillStyle=isk?'#4a0808':'#404040';
      ctx.fillRect(fsx-8,fsy,16,2); ctx.fillRect(fsx-1,fsy-6,2,10);
      // Band highlights
      ctx.fillStyle='rgba(180,180,180,.2)'; ctx.fillRect(fsx-8,fsy,16,1); ctx.fillRect(fsx-1,fsy-6,2,1);
      // Lock
      ctx.fillStyle=isk?'#800808':'#c0a020'; ctx.fillRect(fsx-2,fsy-3,4,4);
      ctx.fillStyle=isk?'#200404':'#806010'; ctx.fillRect(fsx-1,fsy-2,2,2);
      if(isk){
        // Skull emblem on skull_chest
        ctx.fillStyle='rgba(200,160,120,.6)';
        ctx.beginPath(); ctx.ellipse(fsx,fsy+3,3,2.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(10,0,0,.8)'; ctx.fillRect(fsx-2,fsy+3,2,2); ctx.fillRect(fsx+1,fsy+3,2,2);
      }

    } else if(f.type==='chest_open') {
      // Looted chest — open lid
      ctx.globalAlpha=0.2; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(fsx,fsy+7,9,3,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle='#4a2808'; ctx.fillRect(fsx-8,fsy,16,8);
      ctx.fillStyle='#3a2008'; ctx.fillRect(fsx-7,fsy+1,14,6);
      ctx.fillStyle='#1a0a04'; ctx.fillRect(fsx-6,fsy+2,12,5); // dark empty interior
      // Open lid propped back
      ctx.fillStyle='#4a2808'; ctx.fillRect(fsx-8,fsy-8,16,5);
      ctx.fillStyle='#3a2008'; ctx.fillRect(fsx-7,fsy-7,14,4);
      ctx.fillStyle='#303030'; ctx.fillRect(fsx-8,fsy-2,16,2); // band
      ctx.fillStyle='rgba(100,80,40,.4)'; ctx.font='8px sans-serif'; ctx.textAlign='center'; ctx.fillText('empty',fsx,fsy+9);

    } else if(f.type==='board') {
      // Wanted board — wooden post with paper poster
      // Post
      ctx.fillStyle='#5a3810'; ctx.fillRect(fsx-2,fsy-16,4,24);
      ctx.fillStyle='#4a2c08'; ctx.fillRect(fsx-1,fsy-15,2,22);
      // Board
      ctx.fillStyle='#7a5020'; ctx.fillRect(fsx-10,fsy-14,20,14);
      ctx.fillStyle='#8a6030'; ctx.fillRect(fsx-9,fsy-13,18,12);
      // Paper poster
      ctx.fillStyle='#e8d8a0'; ctx.fillRect(fsx-7,fsy-12,14,10);
      // Wanted text lines
      ctx.fillStyle='#2a1800';
      ctx.fillRect(fsx-5,fsy-11,10,1); // WANTED
      ctx.fillRect(fsx-4,fsy-9,8,1);   // name
      // Crude face sketch on poster
      ctx.fillStyle='#3a2408';
      ctx.beginPath(); ctx.ellipse(fsx,fsy-7,3,3.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e8d8a0'; ctx.fillRect(fsx-2,fsy-8,2,2); ctx.fillRect(fsx+1,fsy-8,2,2);
      // Nail heads
      ctx.fillStyle='#808080';
      ctx.fillRect(fsx-8,fsy-13,2,2); ctx.fillRect(fsx+6,fsy-13,2,2);
      ctx.fillRect(fsx-8,fsy-3,2,2);  ctx.fillRect(fsx+6,fsy-3,2,2);
    }

    ctx.restore();

    const dToFeature = Math.hypot(player.x-(f.x*T+T/2), player.y-(f.y*T+T/2));
    if (dToFeature < T*2.5) {
      const pulse = 0.65 + Math.sin(Date.now()*.006)*0.35;
      ctx.save(); ctx.globalAlpha = pulse;
      ctx.fillStyle='#f0d060'; ctx.font='bold 7px sans-serif'; ctx.textAlign='center';
      ctx.fillText(`[E] ${f.label}`, fsx, fsy-18);
      ctx.globalAlpha=1; ctx.restore();
    }
  }

  // Draw badlands enemies with per-type pixel-art sprites
  for(const e of badlandsEnemies) {
    const def=BADLANDS_ENEMY_DEFS[e.type];
    if(!def) continue;
    const sx=e.x-cx, sy=e.y-cy;
    if(sx<-T||sx>canvas.width+T||sy<-T||sy>canvas.height+T) continue;
    ctx.save();
    ctx.globalAlpha = e.flashTimer > 0 ? 0.38 : 1;
    // Shadow
    ctx.globalAlpha *= 0.3; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx,sy+13,9,4,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = e.flashTimer > 0 ? 0.38 : 1;

    if(e.type==='outlaw') {
      // Body — tan vest
      ctx.fillStyle='#c08030'; ctx.fillRect(sx-6,sy-8,12,14);
      // Shirt under vest
      ctx.fillStyle='#e0c080'; ctx.fillRect(sx-4,sy-6,8,10);
      // Head
      ctx.fillStyle='#d4a060'; ctx.fillRect(sx-5,sy-18,10,10);
      // Hat
      ctx.fillStyle='#5a3010'; ctx.fillRect(sx-7,sy-22,14,5); ctx.fillRect(sx-4,sy-26,8,5);
      // Hat brim highlight
      ctx.fillStyle='#7a4820'; ctx.fillRect(sx-7,sy-22,14,2);
      // Boots
      ctx.fillStyle='#4a2808'; ctx.fillRect(sx-6,sy+6,5,7); ctx.fillRect(sx+1,sy+6,5,7);
      // Gun arm
      ctx.fillStyle='#c08030'; ctx.fillRect(sx+6,sy-5,7,3);
      ctx.fillStyle='#606060'; ctx.fillRect(sx+10,sy-6,4,5);
      // Belt
      ctx.fillStyle='#6a4010'; ctx.fillRect(sx-6,sy+2,12,3);
      ctx.fillStyle='#c0a040'; ctx.fillRect(sx-1,sy+2,3,3); // buckle
    } else if(e.type==='rattler') {
      // Snake body — S-curve segments
      const seg=[{x:0,y:0},{x:6,y:-3},{x:10,y:2},{x:6,y:7},{x:0,y:9},{x:-6,y:6}];
      ctx.fillStyle='#806020';
      for(let i=0;i<seg.length-1;i++){
        const a=seg[i],b=seg[i+1];
        ctx.fillRect(sx+a.x-3,sy+a.y-3,6,6);
      }
      // Scales pattern
      ctx.fillStyle='#a08030';
      for(let i=0;i<seg.length;i+=2){ctx.fillRect(sx+seg[i].x-2,sy+seg[i].y-2,4,4);}
      // Head
      ctx.fillStyle='#90701a'; ctx.fillRect(sx-5,sy-6,10,8);
      // Eyes (red)
      ctx.fillStyle='#e02020'; ctx.fillRect(sx-3,sy-5,3,3); ctx.fillRect(sx+1,sy-5,3,3);
      // Tongue
      ctx.fillStyle='#e02060'; ctx.fillRect(sx-1,sy+2,2,5); ctx.fillRect(sx-3,sy+6,2,2); ctx.fillRect(sx+1,sy+6,2,2);
      // Rattle tail
      ctx.fillStyle='#c0a040'; ctx.fillRect(sx-8,sy+4,4,4); ctx.fillRect(sx-10,sy+5,3,3);
    } else if(e.type==='vulture') {
      // Wings spread
      ctx.fillStyle='#302820';
      ctx.fillRect(sx-20,sy-6,12,6); // left wing
      ctx.fillRect(sx+8,sy-6,12,6);  // right wing
      ctx.fillStyle='#504030';
      ctx.fillRect(sx-18,sy-4,8,4);
      ctx.fillRect(sx+10,sy-4,8,4);
      // Wing tips (lighter)
      ctx.fillStyle='#706050';
      ctx.fillRect(sx-20,sy-3,4,3); ctx.fillRect(sx+16,sy-3,4,3);
      // Body
      ctx.fillStyle='#403830'; ctx.fillRect(sx-7,sy-4,14,14);
      ctx.fillStyle='#504840'; ctx.fillRect(sx-5,sy-2,10,10);
      // Neck + head (bare red)
      ctx.fillStyle='#e03020'; ctx.fillRect(sx-3,sy-12,6,10);
      // Head (larger)
      ctx.fillStyle='#c02818'; ctx.fillRect(sx-5,sy-18,10,9);
      // Beak
      ctx.fillStyle='#d0a020'; ctx.fillRect(sx+4,sy-14,5,3);
      // Eye
      ctx.fillStyle='#f0e010'; ctx.fillRect(sx+1,sy-16,3,3); ctx.fillStyle='#000'; ctx.fillRect(sx+2,sy-15,2,2);
      // Talons
      ctx.fillStyle='#c08010'; ctx.fillRect(sx-5,sy+10,4,4); ctx.fillRect(sx+1,sy+10,4,4);
    } else if(e.type==='dustScorpion') {
      // Carapace body
      ctx.fillStyle='#b07820'; ctx.fillRect(sx-8,sy-4,16,12);
      ctx.fillStyle='#d09828'; ctx.fillRect(sx-6,sy-2,12,8);
      // Segmented tail (curled up)
      ctx.fillStyle='#c08820';
      ctx.fillRect(sx+6,sy-8,4,4); ctx.fillRect(sx+8,sy-12,4,4); ctx.fillRect(sx+6,sy-16,4,4);
      // Stinger
      ctx.fillStyle='#e04020'; ctx.fillRect(sx+4,sy-18,4,4);
      // Claws left
      ctx.fillStyle='#c08820'; ctx.fillRect(sx-14,sy-4,7,4); ctx.fillRect(sx-16,sy-7,5,4);
      // Claws right
      ctx.fillRect(sx+7,sy-4,7,4); ctx.fillRect(sx+11,sy-7,5,4);
      // Legs (3 pairs)
      ctx.fillStyle='#a06010';
      for(let i=0;i<3;i++){ ctx.fillRect(sx-12+i*2,sy+4,2,6); ctx.fillRect(sx+10-i*2,sy+4,2,6); }
      // Eyes
      ctx.fillStyle='#e04020'; ctx.fillRect(sx-3,sy-4,3,3); ctx.fillRect(sx+1,sy-4,3,3);
    } else if(e.type==='desperado') {
      // Long coat — dark red
      ctx.fillStyle='#701010'; ctx.fillRect(sx-8,sy-10,16,22);
      ctx.fillStyle='#901818'; ctx.fillRect(sx-6,sy-8,12,18);
      // Coat lapels
      ctx.fillStyle='#501010'; ctx.fillRect(sx-6,sy-8,4,10); ctx.fillRect(sx+2,sy-8,4,10);
      // Head
      ctx.fillStyle='#c08050'; ctx.fillRect(sx-5,sy-20,10,11);
      // Skull mask lower face
      ctx.fillStyle='#e0e0e0'; ctx.fillRect(sx-4,sy-14,8,6);
      ctx.fillStyle='#201010'; ctx.fillRect(sx-3,sy-13,2,2); ctx.fillRect(sx+1,sy-13,2,2); // eye holes
      ctx.fillRect(sx-3,sy-10,6,2); // teeth line
      // Hat — wide brim
      ctx.fillStyle='#200808'; ctx.fillRect(sx-9,sy-24,18,6); ctx.fillRect(sx-5,sy-30,10,7);
      // Hat band
      ctx.fillStyle='#c03020'; ctx.fillRect(sx-5,sy-24,10,2);
      // Dual pistols
      ctx.fillStyle='#404040'; ctx.fillRect(sx-14,sy-6,6,3); ctx.fillRect(sx+8,sy-6,6,3);
      // Boots
      ctx.fillStyle='#300808'; ctx.fillRect(sx-7,sy+12,5,8); ctx.fillRect(sx+2,sy+12,5,8);
      // Spurs
      ctx.fillStyle='#c0a020'; ctx.fillRect(sx-8,sy+18,3,2); ctx.fillRect(sx+6,sy+18,3,2);
    } else if(e.type==='dustDevil') {
      // Swirling vortex — animated rings
      const dt2=Date.now()*.004;
      for(let ring=0;ring<3;ring++){
        const r=6+ring*6, ang=dt2+ring*1.2;
        const ox=Math.cos(ang)*r*0.5, oy=Math.sin(ang)*r*0.3;
        const alpha=0.5-ring*0.12;
        ctx.globalAlpha=(e.flashTimer>0?0.38:1)*alpha;
        ctx.strokeStyle=ring===0?'#f0e060':ring===1?'#c0a040':'#a07820';
        ctx.lineWidth=3-ring;
        ctx.beginPath(); ctx.arc(sx+ox,sy+oy-4,r,0,Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha=e.flashTimer>0?0.38:1;
      // Center eye
      ctx.fillStyle='rgba(240,220,80,.9)'; ctx.beginPath(); ctx.arc(sx,sy-4,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#402000'; ctx.beginPath(); ctx.arc(sx,sy-4,2,0,Math.PI*2); ctx.fill();
      // Debris particles
      const debrisAng=dt2*2;
      ctx.fillStyle='#a07840';
      for(let d=0;d<4;d++){
        const da=debrisAng+d*1.57;
        ctx.fillRect(sx+Math.cos(da)*14-1,sy+Math.sin(da)*10-4-1,3,3);
      }
    } else {
      // Fallback generic enemy
      ctx.fillStyle=def.color;
      ctx.beginPath(); ctx.arc(sx,sy,10,0,Math.PI*2); ctx.fill();
      ctx.font='16px serif'; ctx.textAlign='center'; ctx.fillText(def.icon,sx,sy+5);
    }

    ctx.globalAlpha=1;
    ctx.restore();
    // HP bar
    if(e.hp<e.maxHp) {
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(sx-14,sy-26,28,5);
      ctx.fillStyle=e.hp/e.maxHp>0.5?'#40c040':'#e04020';
      ctx.fillRect(sx-14,sy-26,28*(e.hp/e.maxHp),5);
      ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=1; ctx.strokeRect(sx-14,sy-26,28,5);
    }
    // Name tag on hover (always show for boss-tier)
    if(e.type==='desperado') {
      ctx.font='bold 8px sans-serif'; ctx.textAlign='center';
      ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillText(def.name,sx+1,sy-30);
      ctx.fillStyle='#e05040'; ctx.fillText(def.name,sx,sy-31);
    }
  }

  drawPlayer();
  drawParticles(cx,cy);

  // Badlands node depletion indicators
  for(const key in badlandsNodes) {
    const n=badlandsNodes[key];
    if(!n.depleted) continue;
    const sx=n.x*T+T/2-cx, sy=n.y*T+T/2-cy;
    if(sx<0||sx>canvas.width||sy<0||sy>canvas.height) continue;
    ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(200,160,60,.6)';
    ctx.fillText('↺',sx,sy+4);
  }

  // Zone label
  ctx.font='bold 13px serif'; ctx.textAlign='center';
  const lx=canvas.width/2, ly=canvas.height/2-80;
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillText('— THE BADLANDS —',lx+1,ly+1);
  ctx.fillStyle='rgba(220,120,40,.65)'; ctx.fillText('— THE BADLANDS —',lx,ly);

  // ── SE Portal beacon arrow ── (shows when exit is off-screen)
  const portalWorldX = (BL_W-2.5)*T, portalWorldY = (BL_H-2)*T;
  const portalSX = portalWorldX - cx, portalSY = portalWorldY - cy;
  const offscreen = portalSX < 0 || portalSX > canvas.width || portalSY < 0 || portalSY > canvas.height;
  if (offscreen) {
    const adx = portalWorldX - player.x, ady = portalWorldY - player.y;
    const ang = Math.atan2(ady, adx);
    const edgeR = Math.min(canvas.width/2, canvas.height/2) - 30;
    const arX = canvas.width/2 + Math.cos(ang)*edgeR;
    const arY = canvas.height/2 + Math.sin(ang)*edgeR;
    const pls = 0.6+0.4*Math.abs(Math.sin(Date.now()*.003));
    ctx.save();
    ctx.globalAlpha = pls * 0.85;
    ctx.translate(arX, arY);
    ctx.rotate(ang);
    ctx.fillStyle='#40ffcc';
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-7,-6); ctx.lineTo(-4,0); ctx.lineTo(-7,6); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    ctx.font='bold 8px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillText('EXIT',1,14);
    ctx.fillStyle='#40ffcc'; ctx.fillText('EXIT',0,13);
    ctx.restore();
  }

  // Minimap
  ctx.restore(); // end ZOOM scale

  // Deep zone darkness vignette — the further west, the darker the edges
  const px2 = Math.floor(player.x/T);
  const DEEP_X2=25, MID_X2=55;
  if(px2 < MID_X2) {
    const depth = px2 < DEEP_X2 ? 1.0 : (MID_X2-px2)/(MID_X2-DEEP_X2);
    const vigAlpha = depth * 0.55;
    const grad = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, canvas.width*0.22,
      canvas.width/2, canvas.height/2, canvas.width*0.72
    );
    grad.addColorStop(0,'rgba(0,0,0,0)');
    grad.addColorStop(1,`rgba(0,0,0,${vigAlpha})`);
    ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height);
    // Red tint in deep zone
    if(px2<DEEP_X2) {
      ctx.fillStyle=`rgba(80,0,0,${depth*0.12})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }

  if(minimapVisible) renderMinimap();
}