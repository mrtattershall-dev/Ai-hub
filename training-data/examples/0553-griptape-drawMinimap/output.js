function drawMinimap() {
  mmCtx.clearRect(0,0,100,100);
  const cx=50,cy=50,scale=0.6;
  mmCtx.fillStyle='rgba(255,255,255,0.07)'; mmCtx.fillRect(0,0,100,100);
  mmCtx.fillStyle='rgba(255,255,255,0.12)';
  mmCtx.fillRect(cx-18*scale,cy-15*scale,36*scale,30*scale);
  guards.forEach(g=>{
    const gx=cx+g.group.position.x*scale, gz=cy+g.group.position.z*scale;
    mmCtx.beginPath(); mmCtx.arc(gx,gz,3,0,Math.PI*2);
    mmCtx.fillStyle=g.alertLevel>0.5?'#ef5350':'#1a3a6a'; mmCtx.fill();
  });
  // Vance — larger dot, orange
  // Chloe — pink dot
  if (chloe.active) {
    const cx2=cx+chloe.group.position.x*scale, cz2=cy+chloe.group.position.z*scale;
    mmCtx.beginPath(); mmCtx.arc(cx2,cz2,4,0,Math.PI*2);
    mmCtx.fillStyle='#f06292'; mmCtx.fill();
    mmCtx.fillStyle='#fff'; mmCtx.font='bold 6px monospace';
    mmCtx.fillText('C',cx2-3,cz2+2);
  }
  if (vance.active) {
    const vx2=cx+vance.group.position.x*scale, vz2=cy+vance.group.position.z*scale;
    mmCtx.beginPath(); mmCtx.arc(vx2,vz2,5,0,Math.PI*2);
    mmCtx.fillStyle=vance.state==='chase'?'#ff2200':'#ff6d00'; mmCtx.fill();
    // Vance label
    mmCtx.fillStyle='#ff6d00'; mmCtx.font='6px monospace';
    mmCtx.fillText('V', vx2-2, vz2-6);
  }
  // Shop marker
  const smx=cx+SHOP_POS.x*scale, smz=cy+SHOP_POS.z*scale;
  mmCtx.beginPath(); mmCtx.arc(smx,smz,4,0,Math.PI*2);
  mmCtx.fillStyle='#aed581'; mmCtx.fill();
  mmCtx.fillStyle='#0a0a0f'; mmCtx.font='bold 6px monospace';
  mmCtx.fillText('S',smx-3,smz+2);

  const px=cx+player.pos.x*scale, pz=cy+player.pos.z*scale;
  mmCtx.beginPath(); mmCtx.arc(px,pz,3,0,Math.PI*2);
  mmCtx.fillStyle='#ffd600'; mmCtx.fill();
  mmCtx.beginPath(); mmCtx.moveTo(px,pz);
  mmCtx.lineTo(px+Math.sin(player.facing)*8,pz+Math.cos(player.facing)*8);
  mmCtx.strokeStyle='#ffd600'; mmCtx.lineWidth=1; mmCtx.stroke();

  // Hidden spots (only visible after buying spot map)
  if (shopState.spotMapOwned) {
    const hiddenSpots=[{x:18,z:-14},{x:-8,z:22},{x:22,z:8},{x:-18,z:0}];
    hiddenSpots.forEach(sp=>{
      const hx=cx+sp.x*scale, hz=cy+sp.z*scale;
      mmCtx.beginPath(); mmCtx.arc(hx,hz,3,0,Math.PI*2);
      mmCtx.fillStyle='rgba(255,214,0,0.5)'; mmCtx.fill();
    });
  }
}