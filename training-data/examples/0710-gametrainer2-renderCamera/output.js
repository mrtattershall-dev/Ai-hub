function renderCamera(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0c0b08'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // World: translate by -cam
  ctx.save(); ctx.translate(-s.cam.x, -s.cam.y);
  // Stars (background parallax)
  for (const st of s.stars) {
    ctx.fillStyle='#ffffff18';
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
  }
  // World border
  ctx.strokeStyle='#3c3a2a'; ctx.lineWidth=3;
  ctx.strokeRect(0,0,s.W,s.H);
  // Grid lines
  ctx.strokeStyle='#1e1c14'; ctx.lineWidth=1;
  for (let x=0;x<s.W;x+=100) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,s.H); ctx.stroke(); }
  for (let y=0;y<s.H;y+=100) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s.W,y); ctx.stroke(); }
  // Gems
  for (const g of s.gems) {
    if (g.col) continue;
    ctx.fillStyle='#42c4a8';
    ctx.beginPath(); ctx.arc(g.x,g.y,g.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#42c4a8cc'; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('◆',g.x,g.y);
  }
  // Player
  ctx.fillStyle='#e8a83266'; ctx.strokeStyle='#e8a832'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(s.player.x,s.player.y,s.player.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.restore();
  // HUD (screen space, no translate)
  ctx.fillStyle='#1a1710cc'; ctx.fillRect(10,10,200,52);
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText(`world: (${Math.round(s.player.x)}, ${Math.round(s.player.y)})`, 18,26);
  ctx.fillText(`cam:   (${Math.round(s.cam.x)}, ${Math.round(s.cam.y)})`, 18,42);
  ctx.fillText(`screen: (${Math.round(s.player.x-s.cam.x)}, ${Math.round(s.player.y-s.cam.y)})`, 18,58);
  // Minimap
  const mm={x:canvas.width-110,y:10,w:100,h:66};
  ctx.fillStyle='#1a1710'; ctx.fillRect(mm.x,mm.y,mm.w,mm.h);
  ctx.strokeStyle='#3c3a2a'; ctx.lineWidth=1; ctx.strokeRect(mm.x,mm.y,mm.w,mm.h);
  for (const g of s.gems) {
    ctx.fillStyle=g.col?'#3c3a2a':'#42c4a8';
    ctx.fillRect(mm.x+g.x/s.W*mm.w-2,mm.y+g.y/s.H*mm.h-2,4,4);
  }
  ctx.fillStyle='#e8a832';
  ctx.fillRect(mm.x+s.player.x/s.W*mm.w-3,mm.y+s.player.y/s.H*mm.h-3,6,6);
  ctx.fillStyle='#3c3a2a66'; ctx.strokeStyle='#3c3a2a';
  ctx.strokeRect(mm.x+s.cam.x/s.W*mm.w,mm.y+s.cam.y/s.H*mm.h,canvas.width/s.W*mm.w,canvas.height/s.H*mm.h);
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText(`Gems: ${s.gems.filter(g=>g.col).length}/5`, canvas.width-100, canvas.height-12);
  ctx.fillText('WASD to move', 12, canvas.height-12);
}