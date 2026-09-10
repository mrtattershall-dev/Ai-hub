function renderPlatformer(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0,0,canvas.width,canvas.height);
  for (let i=0; i<s.platforms.length; i++) {
    const pl = s.platforms[i];
    const visited = s.platformsTouched.has(i);
    ctx.fillStyle = visited ? '#3dd68c' : '#333344';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = visited ? '#3dd68c' : '#555566';
    ctx.font = 'bold 10px monospace'; ctx.textAlign='center';
    ctx.fillText(visited ? '✓' : String(i+1), pl.x+pl.w/2, pl.y-5);
    ctx.textAlign='left';
  }
  const p = s.player;
  ctx.fillStyle = '#7c6bff';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  // physics labels
  ctx.fillStyle = '#555566'; ctx.font = '10px monospace';
  ctx.fillText(`vy: ${p.vy.toFixed(1)}`, 8, 18);
  ctx.fillText(`onGround: ${p.onGround}`, 8, 32);
  ctx.fillStyle = '#888899'; ctx.font = '11px monospace'; ctx.textAlign='center';
  ctx.fillText('Space / W / ↑ to jump   ←→ to move', canvas.width/2, canvas.height-10);
  ctx.fillText(`Platforms: ${s.platformsTouched.size}/3`, canvas.width/2, 20);
  ctx.textAlign='left';
}