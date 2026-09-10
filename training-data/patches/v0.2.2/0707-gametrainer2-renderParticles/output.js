function renderParticles(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0c0b08'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const active = pPool.filter(p=>p.active);
  for (const p of active) {
    const alpha = p.life/p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r*(p.type==='fire'?alpha:1), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // Buttons
  const types=['fire','explosion','sparkle'];
  const colors=['#e8a832','#e05a4a','#42c4a8'];
  types.forEach((t,i)=>{
    const bx=12+i*110, by=canvas.height-46;
    const active2=s.mode===t, seen=s.modesSeen.has(t);
    ctx.fillStyle=active2?colors[i]+'33':'#1a1710';
    ctx.strokeStyle=active2?colors[i]:seen?colors[i]+'55':'#3c3a2a';
    ctx.lineWidth=active2?1.5:1;
    ctx.beginPath(); ctx.roundRect(bx,by,100,34,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle=active2?colors[i]:seen?colors[i]+'99':'#4a4838';
    ctx.font=(active2?'bold ':'')+'12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText((seen?'✓ ':'')+t, bx+50, by+17);
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  // Stats
  ctx.fillStyle='#2c2a22'; ctx.fillRect(12,10,200,44);
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText(`pool active:  ${active.length} / ${POOL_SIZE}`, 20,28);
  ctx.fillText(`mode: ${s.mode}`, 20,46);
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText('click & drag to emit | buttons to switch type', 12, canvas.height-56);
}