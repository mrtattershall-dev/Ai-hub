function emitParticle(x, y, type) {
  const p = pPool.find(p=>!p.active); if (!p) return;
  p.active=true; p.x=x; p.y=y; p.type=type;
  if (type==='fire') {
    p.vx=(Math.random()-.5)*3; p.vy=-Math.random()*5-2;
    p.life=p.maxLife=50+Math.random()*20;
    p.r=4+Math.random()*5;
    p.color=['#e8a832','#e05a4a','#f5cc78'][Math.floor(Math.random()*3)];
  } else if (type==='explosion') {
    const angle=Math.random()*Math.PI*2, spd=3+Math.random()*5;
    p.vx=Math.cos(angle)*spd; p.vy=Math.sin(angle)*spd;
    p.life=p.maxLife=30+Math.random()*20;
    p.r=3+Math.random()*6;
    p.color=['#e05a4a','#f5cc78','#ffffff'][Math.floor(Math.random()*3)];
  } else { // sparkle
    const angle=Math.random()*Math.PI*2, spd=1+Math.random()*3;
    p.vx=Math.cos(angle)*spd; p.vy=Math.sin(angle)*spd-3;
    p.life=p.maxLife=80+Math.random()*40;
    p.r=2+Math.random()*3;
    p.color=['#5ecf7a','#42c4a8','#5a9ee0','#9e78e8'][Math.floor(Math.random()*4)];
  }
}