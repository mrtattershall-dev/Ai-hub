function renderLayerDemo(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Left: visual preview
  const pw = canvas.width * 0.45;
  // bg
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(20, 20, pw - 40, canvas.height - 40);
  // enemies
  ctx.fillStyle = '#ff5a5a99';
  ctx.fillRect(pw*0.15, canvas.height*0.3, 50, 50);
  ctx.fillRect(pw*0.4, canvas.height*0.5, 45, 45);
  // player
  ctx.fillStyle = '#7c6bffcc';
  ctx.beginPath(); ctx.arc(pw*0.5, canvas.height*0.6, 22, 0, Math.PI*2); ctx.fill();
  // ui
  ctx.fillStyle = '#3dd68c';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('SCORE: 100', 30, 40);
  ctx.fillText('LIVES: 3', 30, 56);

  // Right: drag list
  const lx = pw + 20, lw = canvas.width - pw - 40;
  ctx.fillStyle = '#888899'; ctx.font = '11px monospace';
  ctx.fillText('Draw Order (drag to sort)', lx, 24);

  s.layers.forEach((l, i) => {
    const y = 40 + i * 52;
    const highlight = s.checked && l.correct === i;
    ctx.fillStyle = highlight ? l.color+'33' : '#1e1e24';
    roundRect(ctx, lx, y, lw, 44, 8);
    ctx.fillStyle = highlight ? l.color : '#333344';
    roundRect(ctx, lx+8, y+12, 20, 20, 4);
    ctx.fillStyle = l.color; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(i+1, lx+18, y+22);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillStyle = '#e8e8f0'; ctx.font = '12px sans-serif';
    ctx.fillText(l.name, lx+36, y+26);
    if (s.checked) {
      ctx.fillStyle = l.correct === i ? '#3dd68c' : '#ff5a5a';
      ctx.font = '14px sans-serif';
      ctx.fillText(l.correct === i ? '✓' : '✗', lx + lw - 24, y + 26);
    }
  });
  if (s.feedback) {
    ctx.fillStyle = s.won ? '#3dd68c' : '#ff5a5a';
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center';
    ctx.fillText(s.feedback, lx + lw/2, canvas.height - 12);
    ctx.textAlign='left';
  }
}