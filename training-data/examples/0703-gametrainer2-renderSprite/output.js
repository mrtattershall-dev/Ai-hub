function renderSprite(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0c0b08'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Ground
  ctx.fillStyle='#2c2a22';
  ctx.fillRect(0, canvas.height-65, canvas.width, 65);
  ctx.fillStyle='#3c3a2a';
  ctx.fillRect(0, canvas.height-66, canvas.width, 3);

  // Draw procedural "sprite" (8 frames of a pixel man)
  const cmap = {idle:'#e8a832',run:'#5ecf7a',jump:'#5a9ee0',fall:'#e05a4a'};
  const col = cmap[s.state];
  const t = s.frame;
  const px = Math.round(s.x), py = Math.round(s.y);
  const sz = 12;

  // Body
  ctx.fillStyle=col+'cc';
  ctx.fillRect(px-sz/2, py-sz*2, sz, sz*2.2);
  // Head
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.arc(px, py-sz*2.5, sz*0.75, 0, Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#0c0b08';
  ctx.fillRect(px + (s.vx<0?-8:3), py-sz*2.7, 4, 4);

  // Legs (animated)
  const legPhase = t * 0.8;
  if (s.state==='run') {
    ctx.fillStyle=col+'99';
    ctx.fillRect(px-8, py, 6, sz + Math.sin(legPhase)*8);
    ctx.fillRect(px+2, py, 6, sz + Math.cos(legPhase)*8);
  } else if (s.state==='jump') {
    ctx.fillStyle=col+'99';
    ctx.fillRect(px-9, py, 6, sz*0.6);
    ctx.fillRect(px+3, py, 6, sz*0.6);
  } else if (s.state==='fall') {
    ctx.fillStyle=col+'99';
    ctx.fillRect(px-9, py, 6, sz*1.5);
    ctx.fillRect(px+3, py, 6, sz*1.5);
  } else {
    ctx.fillStyle=col+'99';
    ctx.fillRect(px-7, py, 6, sz);
    ctx.fillRect(px+1, py, 6, sz);
  }

  // HUD — state strip
  const states = ['idle','run','jump','fall'];
  const sw = 80, sx0 = 12;
  states.forEach((st,i) => {
    const sx = sx0 + i*(sw+8);
    const active = s.state === st;
    const seen = s.statesSeen.has(st);
    ctx.fillStyle = active ? cmap[st]+'44' : seen ? '#2c2a2244' : '#1a171044';
    ctx.strokeStyle = active ? cmap[st] : seen ? cmap[st]+'66' : '#3c3a2a';
    ctx.lineWidth = active ? 1.5 : 1;
    roundR(sx, 10, sw, 28, 6);
    ctx.fillStyle = active ? cmap[st] : seen ? cmap[st]+'99' : '#4a4838';
    ctx.font = (active ? 'bold ' : '') + '11px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText((seen?'✓ ':'')+st, sx+sw/2, 24);
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText('A/D move  |  Space jump  |  Trigger all 4 states', 12, canvas.height-12);
  ctx.fillText(`frame: ${s.frame}   elapsed: ${s.elapsed}`, canvas.width-180, canvas.height-12);
}