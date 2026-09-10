function renderDodger(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Stars
  ctx.fillStyle = '#ffffff18';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i*97+s.timer)%canvas.width, (i*61+s.timer*0.3)%canvas.height, 1.5, 1.5);
  }
  // Asteroids
  for (const a of s.asteroids) {
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
    ctx.fillStyle = '#555566'; ctx.fill();
    ctx.strokeStyle = '#888899'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Ship
  const p = s.player;
  ctx.fillStyle = '#7c6bff';
  ctx.beginPath();
  ctx.moveTo(p.x + p.w/2, p.y);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.lineTo(p.x, p.y + p.h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b8abff'; ctx.lineWidth = 1.5; ctx.stroke();

  // HUD
  ctx.fillStyle = '#38d9c0'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`Survived: ${s.survived}s / 10s`, 12, 20);
  if (s.survived < 10) {
    const pct = s.survived/10;
    ctx.fillStyle = '#333344'; ctx.fillRect(12, 28, 160, 6);
    ctx.fillStyle = '#38d9c0'; ctx.fillRect(12, 28, 160*pct, 6);
  }
  ctx.fillStyle = '#555566'; ctx.font = '11px monospace';
  ctx.fillText('keys.ArrowLeft / keys.ArrowRight', 12, canvas.height-12);
}