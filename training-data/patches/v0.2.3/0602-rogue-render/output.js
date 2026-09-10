function render(){
  // Screen shake
  let sx=0, sy=0;
  if(G.shakeMag>0){
    sx=(Math.random()-0.5)*G.shakeMag*2.5;
    sy=(Math.random()-0.5)*G.shakeMag*2.5;
    G.shakeMag*=0.72;
    if(G.shakeMag<0.2) G.shakeMag=0;
  }
  ctx.save(); ctx.translate(sx,sy);
  ctx.fillStyle=C.void; ctx.fillRect(-8,-8,W+16,H+16);
  renderTiles();
  renderParticles();
  renderProjectiles();
  renderOrganDrops();
  renderEnemies();
  if(G.boss) renderBoss();
  renderPlayer();
  ctx.restore();
  renderMinimap();
}