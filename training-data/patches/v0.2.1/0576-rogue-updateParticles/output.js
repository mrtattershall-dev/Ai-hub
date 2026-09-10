function updateParticles(dt){
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i];
    p.vy += 220*dt;            // gravity
    p.vx *= Math.pow(0.82,60*dt);
    p.vy *= Math.pow(0.86,60*dt);
    p.x  += p.vx*dt;
    p.y  += p.vy*dt;
    p.life -= p.decay*dt;
    if(p.life<=0){
      if(p.settles && (p.col===C.rouge||p.col===C.bright)) addSat(p.x,p.y,1);
      G.particles.splice(i,1);
    }
  }
}