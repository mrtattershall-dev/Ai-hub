function renderProjectiles(){
  for(const p of G.projectiles){
    ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=p.col; ctx.globalAlpha=0.22;
    ctx.beginPath(); ctx.arc(p.x-p.vx*0.02,p.y-p.vy*0.02,2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}