function renderShooter(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const e of s.enemies) {
    if (!e.alive) {
      if (e.hit > 0) {
        ctx.fillStyle = '#ff5a5a44';
        ctx.fillRect(e.x-4, e.y-4, e.w+8, e.h+8);
        ctx.fillStyle = '#3dd68c'; ctx.font = 'bold 14px monospace'; ctx.textAlign='center';
        ctx.fillText('HIT!', e.x+e.w/2, e.y+e.h/2+5);
        ctx.textAlign='left';
      }
      continue;
    }
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = '#0a0a0c'; ctx.font = 'bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('👾', e.x+e.w/2, e.y+e.h/2);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }
  for (const b of s.bullets) {
    ctx.fillStyle = '#f5a623';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  const p = s.player;
  ctx.fillStyle = '#7c6bff';
  ctx.beginPath(); ctx.moveTo(p.x+p.w/2, p.y); ctx.lineTo(p.x+p.w, p.y+p.h); ctx.lineTo(p.x, p.y+p.h); ctx.closePath(); ctx.fill();

  // AABB debug label
  ctx.strokeStyle = '#7c6bff44'; ctx.setLineDash([3,4]); ctx.lineWidth=1;
  for (const b of s.bullets) { ctx.strokeRect(b.x, b.y, b.w, b.h); }
  ctx.setLineDash([]);

  ctx.fillStyle = '#888899'; ctx.font = '11px monospace'; ctx.textAlign='center';
  ctx.fillText('← → move  |  Space / Click to shoot', canvas.width/2, canvas.height-10);
  ctx.fillText(`overlaps() checks: ${s.bullets.length} × ${s.enemies.filter(e=>e.alive).length}  |  Killed: ${s.killed}/6`, canvas.width/2, 20);
  ctx.textAlign='left';
}