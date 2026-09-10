function renderFSM(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0c0b08'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Grid bg
  ctx.strokeStyle='#161410'; ctx.lineWidth=1;
  for (let x=0;x<canvas.width;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for (let y=0;y<canvas.height;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}

  // Detection radius
  for (const e of s.enemies) {
    ctx.strokeStyle='#3c3a2a33'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(e.x,e.y,140,0,Math.PI*2); ctx.stroke();
  }
  // Enemies
  const scols={idle:'#4a4838',chase:'#e05a4a',attack:'#e8a832',flee:'#9e78e8'};
  for (const e of s.enemies) {
    const col=scols[e.state]||(e.flash>0?'#fff':'#e05a4a');
    ctx.fillStyle=e.flash>0?'#ffffff44':col+'33';
    ctx.strokeStyle=e.flash>0?'#ffffff':col;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // Health bar
    ctx.fillStyle='#1a1710'; ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2,5);
    ctx.fillStyle=col; ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2*(e.health/3),5);
    // State label
    ctx.fillStyle=col; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(e.state, e.x, e.y-e.r-12);
  }
  // Player
  ctx.fillStyle='#e8a83244'; ctx.strokeStyle='#e8a832'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(s.player.x,s.player.y,s.player.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e8a832'; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('YOU', s.player.x, s.player.y-s.player.r-4);
  // HUD
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  const allStates=['idle','chase','attack','flee'];
  ctx.fillStyle='#1a1710cc'; ctx.fillRect(10,10,220,20+allStates.length*18);
  allStates.forEach((st,i)=>{
    const seen=s.statesUnlocked.has(st);
    ctx.fillStyle=seen?scols[st]:'#3c3a2a';
    ctx.font=(seen?'bold ':'')+'11px monospace';
    ctx.fillText((seen?'✓ ':' ') + st, 18, 28+i*18);
  });
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText('WASD move  |  Space attack', 12, canvas.height-12);
}