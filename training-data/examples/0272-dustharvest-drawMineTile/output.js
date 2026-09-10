function drawMineTile(t, sx, sy) {
  const c = MINE_TILE_COLORS[t] || MINE_TILE_COLORS[TL.MINE_WALL];
  ctx.fillStyle = c[0]; ctx.fillRect(sx, sy, T, T);

  if (t === TL.MINE_FLOOR) {
    // Rough hewn stone floor — deterministic per tile
    const mh=(sx*2654435761+sy*1013904223)>>>0;
    const mh2=(sx*1013904223+sy*2654435761)>>>0;
    // Surface rock patches
    if(mh%7<2){ ctx.fillStyle='rgba(40,34,28,.5)'; ctx.fillRect(sx+(mh%14)+3,sy+(mh2%12)+4,6,4); }
    if(mh2%9<2){ ctx.fillStyle='rgba(30,25,18,.4)'; ctx.fillRect(sx+(mh2%18)+2,sy+(mh%10)+3,4,3); }
    // Chisel marks — faint diagonal scratches
    ctx.strokeStyle='rgba(20,15,10,.2)'; ctx.lineWidth=1;
    if(mh%5===0){ ctx.beginPath(); ctx.moveTo(sx+(mh%20)+2,sy+(mh2%10)+4); ctx.lineTo(sx+(mh%20)+8,sy+(mh2%10)+8); ctx.stroke(); }
    if(mh2%6===0){ ctx.beginPath(); ctx.moveTo(sx+(mh2%22)+2,sy+(mh%14)+3); ctx.lineTo(sx+(mh2%22)+6,sy+(mh%14)+9); ctx.stroke(); }
    // Gravel pits — tiny dots
    ctx.fillStyle='rgba(25,18,12,.35)';
    if(mh%3===0) ctx.fillRect(sx+(mh%24)+2,sy+(mh2%22)+3,2,2);
    if(mh2%4===0) ctx.fillRect(sx+(mh2%20)+4,sy+(mh%20)+5,2,1);
    // Puddle — rare
    if(mh%17<1){
      const pu=0.3+0.15*Math.sin(Date.now()*.002+sx*.1);
      ctx.fillStyle=`rgba(20,40,60,${pu})`; ctx.beginPath(); ctx.ellipse(sx+(mh%16)+4,sy+(mh2%16)+4,5,3,0,0,Math.PI*2); ctx.fill();
    }
  } else if (t === TL.MINE_WALL) {
    // Rough stone wall — layered rock face with depth
    const mwh=(sx*7919+sy*6271)&0xFFFF;
    const mwh2=(sx*6271+sy*7919)&0xFFFF;
    ctx.fillStyle='#0e0c0b'; ctx.fillRect(sx+2,sy+2,T-4,T-4);
    // Two rock layer tones
    ctx.fillStyle='#161412'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    if(mwh%3===0){ ctx.fillStyle='#1c1a16'; ctx.fillRect(sx+4,sy+(mwh%14)+3,T-8,5); }
    if(mwh2%4===0){ ctx.fillStyle='#131210'; ctx.fillRect(sx+(mwh2%10)+3,sy+4,5,T-8); }
    // Horizontal strata cracks
    ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+3,sy+(mwh%10)+6); ctx.lineTo(sx+T-4,sy+(mwh%10)+6+(mwh2%4)-2); ctx.stroke();
    // Vertical joint
    if(mwh%2===0){ ctx.beginPath(); ctx.moveTo(sx+(mwh%12)+5,sy+3); ctx.lineTo(sx+(mwh%12)+5+(mwh2%5)-2,sy+T-4); ctx.stroke(); }
    // Surface moisture gleam — very faint
    if(mwh%7<2){ ctx.fillStyle='rgba(40,50,60,.15)'; ctx.fillRect(sx+(mwh%18)+3,sy+(mwh2%16)+3,3,6); }
    // Top-left lit edge (implied light from above)
    ctx.fillStyle='rgba(255,255,255,.03)'; ctx.fillRect(sx+2,sy+2,T-4,2); ctx.fillRect(sx+2,sy+2,2,T-4);
    // Bottom-right shadow
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(sx+2,sy+T-4,T-4,2); ctx.fillRect(sx+T-4,sy+2,2,T-4);
  } else if (t === TL.COAL_VEIN) {
    ctx.fillStyle='#1a1816'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    // Coal seam — very dark with satin sheen
    ctx.fillStyle='#222020'; ctx.fillRect(sx+5,sy+5,T-10,T-10);
    // Thick irregular coal band
    ctx.fillStyle='#2c2a28'; ctx.fillRect(sx+4,sy+7,T-8,7);
    ctx.fillStyle='#181614'; ctx.fillRect(sx+4,sy+15,T-8,5);
    // Satin sheen — coal reflects at one angle
    ctx.fillStyle='rgba(100,90,80,.2)'; ctx.fillRect(sx+5,sy+8,T-10,2);
    ctx.fillStyle='rgba(140,130,110,.15)'; ctx.fillRect(sx+6,sy+8,4,1);
    // Coal grit flecks
    ctx.fillStyle='rgba(60,55,50,.5)';
    ctx.fillRect(sx+6,sy+12,3,2); ctx.fillRect(sx+T-9,sy+10,3,2); ctx.fillRect(sx+8,sy+T-10,3,2);
    // Matrix rock showing through
    ctx.fillStyle='rgba(35,30,25,.6)';
    ctx.fillRect(sx+T-8,sy+T-9,5,4);
  } else if (t === TL.COPPER_VEIN) {
    ctx.fillStyle='#5a2808'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    // Copper ore — orange-brown irregular patches
    ctx.fillStyle='#c06020'; ctx.fillRect(sx+6,sy+7,8,6);
    ctx.fillStyle='#e08040'; ctx.fillRect(sx+8,sy+8,5,4);
    ctx.fillStyle='#d07030'; ctx.fillRect(sx+T-11,sy+8,5,5);
    // Verdigris hint
    ctx.fillStyle='rgba(40,120,60,.3)'; ctx.fillRect(sx+10,sy+10,3,2);
    // Ore glint
    ctx.fillStyle='rgba(255,180,80,.3)'; ctx.fillRect(sx+9,sy+8,2,2);
  } else if (t === TL.IRON_VEIN) {
    ctx.fillStyle='#252830'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    // Iron — grey metallic bands
    ctx.fillStyle='#606878'; ctx.fillRect(sx+5,sy+8,T-10,4);
    ctx.fillStyle='#808898'; ctx.fillRect(sx+5,sy+9,T-10,2);
    ctx.fillStyle='#505868'; ctx.fillRect(sx+5,sy+15,T-10,3);
    // Metallic glint
    ctx.fillStyle='rgba(180,190,210,.4)'; ctx.fillRect(sx+8,sy+9,4,1);
  } else if (t === TL.GOLD_VEIN) {
    ctx.fillStyle='#503010'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const glow = 0.5+Math.sin(Date.now()*.003)*0.3;
    // Gold vein — irregular bright seam
    ctx.fillStyle=`rgba(200,140,10,${glow})`;
    ctx.fillRect(sx+5,sy+6,3,T-12);
    ctx.fillRect(sx+8,sy+8,4,8);
    ctx.fillStyle=`rgba(240,190,40,${glow*0.8})`;
    ctx.fillRect(sx+6,sy+7,2,T-14);
    // Bright fleck
    ctx.fillStyle=`rgba(255,230,80,${glow})`;
    ctx.fillRect(sx+7,sy+10,2,2);
    ctx.fillRect(sx+T-9,sy+8,2,2);
  } else if (t === TL.CRYSTAL_VEIN) {
    ctx.fillStyle='#0e0c20'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const pulse = 0.4+Math.sin(Date.now()*.005+sx)*0.4;
    // Crystal formation — angular facets
    ctx.fillStyle=`rgba(60,120,220,${pulse})`;
    // Main crystal spike
    ctx.beginPath();
    ctx.moveTo(sx+T/2, sy+5);
    ctx.lineTo(sx+T/2+5, sy+T-6);
    ctx.lineTo(sx+T/2-5, sy+T-6);
    ctx.closePath(); ctx.fill();
    // Side crystal
    ctx.fillStyle=`rgba(80,160,240,${pulse*0.7})`;
    ctx.beginPath();
    ctx.moveTo(sx+T/2+4, sy+9);
    ctx.lineTo(sx+T/2+9, sy+T-8);
    ctx.lineTo(sx+T/2+2, sy+T-8);
    ctx.closePath(); ctx.fill();
    // Facet highlight
    ctx.fillStyle=`rgba(180,220,255,${pulse*0.5})`;
    ctx.fillRect(sx+T/2-1, sy+6, 2, 5);
  } else if (t === TL.MINE_EXIT) {
    ctx.fillStyle='#1a3018'; ctx.fillRect(sx+2,sy+2,T-4,T-4);
    // Doorway arch
    ctx.fillStyle='#0a1808'; ctx.fillRect(sx+8,sy+6,T-16,T-10);
    ctx.fillStyle='#0a1808';
    ctx.beginPath(); ctx.arc(sx+T/2,sy+10,8,Math.PI,0); ctx.fill();
    // Door frame — wooden planks
    ctx.fillStyle='#5a3818'; ctx.fillRect(sx+6,sy+5,2,T-9);
    ctx.fillRect(sx+T-8,sy+5,2,T-9);
    ctx.fillRect(sx+6,sy+5,T-12,2);
    // Daylight glow through door
    const eg=0.3+Math.sin(Date.now()*.002)*0.1;
    ctx.fillStyle=`rgba(100,180,80,${eg})`; ctx.fillRect(sx+9,sy+8,T-18,T-14);
    // Arrow indicator
    ctx.fillStyle='rgba(100,200,80,.7)';
    ctx.beginPath();
    ctx.moveTo(sx+T/2,sy+10); ctx.lineTo(sx+T/2-4,sy+16); ctx.lineTo(sx+T/2+4,sy+16);
    ctx.closePath(); ctx.fill();
  } else if (t === TL.MINE_SHAFT_DOWN) {
    ctx.fillStyle='#100810'; ctx.fillRect(sx+4,sy+4,T-8,T-8);
    // Shaft opening — dark void
    ctx.fillStyle='#060408'; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2,9,7,0,0,Math.PI*2); ctx.fill();
    // Shaft rim — stone edge
    ctx.strokeStyle='rgba(80,20,100,.7)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2,10,8,0,0,Math.PI*2); ctx.stroke();
    // Down indicator
    ctx.fillStyle='rgba(140,60,180,.8)';
    ctx.beginPath();
    ctx.moveTo(sx+T/2,sy+T/2+5); ctx.lineTo(sx+T/2-4,sy+T/2); ctx.lineTo(sx+T/2+4,sy+T/2);
    ctx.closePath(); ctx.fill();
  } else if (t === TL.MINE_SHAFT_UP) {
    ctx.fillStyle='#081018'; ctx.fillRect(sx+4,sy+4,T-8,T-8);
    // Shaft opening
    ctx.fillStyle='#040810'; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2,9,7,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(20,80,120,.7)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2,10,8,0,0,Math.PI*2); ctx.stroke();
    // Up indicator
    ctx.fillStyle='rgba(60,140,200,.8)';
    ctx.beginPath();
    ctx.moveTo(sx+T/2,sy+T/2-5); ctx.lineTo(sx+T/2-4,sy+T/2); ctx.lineTo(sx+T/2+4,sy+T/2);
    ctx.closePath(); ctx.fill();
  } else if (t === TL.SILVER_VEIN) {
    ctx.fillStyle='#1e2028'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const sp = 0.5+Math.sin(Date.now()*.002+sx*.7)*0.3;
    // Silver — bright cold metallic
    ctx.fillStyle=`rgba(160,175,200,${sp})`;
    ctx.fillRect(sx+6,sy+7,T-12,4);
    ctx.fillStyle=`rgba(200,210,230,${sp*0.7})`;
    ctx.fillRect(sx+7,sy+8,T-14,2);
    ctx.fillRect(sx+8,sy+13,T-16,3);
    // Cold glint
    ctx.fillStyle=`rgba(220,230,255,${sp})`;
    ctx.fillRect(sx+8,sy+8,2,1);
  } else if (t === TL.SINGING_VEIN) {
    ctx.fillStyle='#1a1018'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const spd = Date.now()*.00085;
    const vp = 0.3+Math.sin(spd+sx*.3+sy*.5)*0.35;
    // Looks like a vein but wrong color — deep purple, unsettling
    ctx.fillStyle=`rgba(130,70,200,${vp})`;
    ctx.fillRect(sx+6,sy+6,4,T-12);
    ctx.fillStyle=`rgba(160,100,220,${vp*0.6})`;
    ctx.fillRect(sx+T-10,sy+8,4,T-16);
    // Outer breathing ring
    ctx.strokeStyle=`rgba(100,60,180,${vp*0.4})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.rect(sx+4,sy+4,T-8,T-8); ctx.stroke();
    // Faint inner glow
    ctx.fillStyle=`rgba(180,120,240,${vp*0.2})`;
    ctx.fillRect(sx+8,sy+8,T-16,T-16);
  }
}