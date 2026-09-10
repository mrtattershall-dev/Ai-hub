function renderCoinCollector(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const c of s.coins) {
    if (c.collected) continue;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.fillStyle = '#f5a623';
    ctx.fill();
    ctx.fillStyle = '#0a0a0c'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('$', c.x, c.y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  // Player
  ctx.beginPath(); ctx.arc(s.player.x, s.player.y, s.player.r, 0, Math.PI*2);
  ctx.fillStyle = '#7c6bff88'; ctx.fill();
  ctx.strokeStyle = '#b8abff'; ctx.lineWidth = 2; ctx.stroke();

  // State display
  ctx.fillStyle = '#333344';
  ctx.fillRect(8, 8, 180, 50);
  ctx.fillStyle = '#888899'; ctx.font = '11px monospace';
  ctx.fillText('state.score = ' + s.score, 16, 26);
  ctx.fillText('state.player.x = ' + Math.round(s.player.x), 16, 44);
  ctx.fillStyle = s.score >= 5 ? '#3dd68c' : '#f5a623';
  ctx.fillText('Collect 5 coins!  ' + s.score + '/5', canvas.width/2 - 60, canvas.height - 12);
}