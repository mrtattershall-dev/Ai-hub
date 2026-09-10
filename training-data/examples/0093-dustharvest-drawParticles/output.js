function drawParticles(cx,cy) {
  for (const p of gameState.particles) {
    const sx=p.x-cx, sy=p.y-cy;
    ctx.globalAlpha = Math.max(0,p.life);
    if (p.text) { ctx.fillStyle=p.color; ctx.font='bold 13px serif'; ctx.textAlign='center'; ctx.fillText(p.text,sx,sy); }
    else { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(sx,sy,p.size,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;
  }
}