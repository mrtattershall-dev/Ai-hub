function renderBouncingBall(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const b of s.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fillStyle = b.color + '99';
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Frame counter
  ctx.fillStyle = '#555566';
  ctx.font = '11px monospace';
  ctx.fillText(`frame ${s.frameCount}`, 12, 20);
  ctx.fillText('update() → render()', 12, canvas.height - 12);
  return s;
}