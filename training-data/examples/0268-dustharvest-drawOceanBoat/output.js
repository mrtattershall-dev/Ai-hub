function drawOceanBoat(cx, cy) {
  const tier = getBoatTier();
  if (!tier) return;
  const tierIdx = BOAT_TIERS.findIndex(b=>b.id===tier.id);

  // Tier-scaled sizes (pixels): rowboat tiny, barque biggest — all much smaller than before
  const tierW = [40, 52, 64, 76][Math.min(tierIdx,3)];
  const tierH = [56, 72, 88, 100][Math.min(tierIdx,3)];
  const bw = tierW, bh = tierH;

  // Draw at boat world position
  const bsx = gameState.boatX - cx - bw/2;
  const bsy = gameState.boatY - cy - bh/2;

  if(bsx>canvas.width/ZOOM+bw||bsx+bw<-bw||bsy>canvas.height/ZOOM+bh||bsy+bh<-bh) return;

  const hullColors=['#7a4e28','#5a3a1c','#4a2e18','#3a2210'];
  const deckColors=['#8a5e38','#6a4424','#5a3820','#4a2c18'];
  const hc=hullColors[Math.min(tierIdx,3)];
  const dc=deckColors[Math.min(tierIdx,3)];

  const boatBob = Math.sin(Date.now()*0.0012)*1.5;
  const bsy2 = bsy + boatBob;

  ctx.save();
  // Hull outline
  ctx.fillStyle='#101010';
  ctx.fillRect(bsx-2,bsy2-2,bw+4,bh+4);
  // Hull
  ctx.fillStyle=hc;
  ctx.fillRect(bsx,bsy2,bw,bh);
  // Deck
  ctx.fillStyle=dc;
  ctx.fillRect(bsx+3,bsy2+3,bw-6,bh-6);
  // Plank lines
  ctx.fillStyle='rgba(0,0,0,.18)';
  for(let i=0;i<3;i++) ctx.fillRect(bsx+3,bsy2+3+i*(Math.floor((bh-6)/3)),bw-6,1);
  // Gunwale highlight
  ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(bsx,bsy2,bw,2);
  // Mast (sloop+)
  if(tierIdx>=1){
    const mx=bsx+bw/2-1, my=bsy2-20+boatBob;
    ctx.fillStyle='#2e1c0c'; ctx.fillRect(mx,my,2,bh+20);
    const bt=Date.now()*0.001;
    const sw=Math.sin(bt)*3;
    ctx.fillStyle='rgba(220,210,180,.72)';
    ctx.beginPath();
    ctx.moveTo(mx+2,my+3); ctx.lineTo(mx+2+12+sw,my+10); ctx.lineTo(mx+2+10+sw,my+32); ctx.lineTo(mx+2,my+36);
    ctx.closePath(); ctx.fill();
  }
  // Second mast (schooner+)
  if(tierIdx>=2){
    const mx2=bsx+bw/2, my2=bsy2+bh/2-12+boatBob;
    ctx.fillStyle='#2e1c0c'; ctx.fillRect(mx2,my2,2,28);
    const bt2=Date.now()*0.0009+1.5;
    const sw2=Math.sin(bt2)*2;
    ctx.fillStyle='rgba(210,200,170,.62)';
    ctx.beginPath();
    ctx.moveTo(mx2+2,my2+2); ctx.lineTo(mx2+2+8+sw2,my2+7); ctx.lineTo(mx2+2+7+sw2,my2+20); ctx.lineTo(mx2+2,my2+24);
    ctx.closePath(); ctx.fill();
  }
  // Cannons (barque)
  if(tierIdx>=3){
    ctx.fillStyle='#282828';
    ctx.fillRect(bsx+1,bsy2+bh/2-3,5,5);
    ctx.fillRect(bsx+bw-6,bsy2+bh/2-3,5,5);
  }
  // Boat name tag
  const bName=['Unnamed','Prairie Wind','Frontier','Iron Shore'];
  ctx.font='bold 6px sans-serif'; ctx.textAlign='center';
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText(bName[Math.min(tierIdx,3)], bsx+bw/2+1, bsy2+bh+9+boatBob);
  ctx.fillStyle='#d0c090'; ctx.fillText(bName[Math.min(tierIdx,3)], bsx+bw/2, bsy2+bh+8+boatBob);
  ctx.restore();
}