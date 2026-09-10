function updateParticles(s, keys, mouse) {
  if (mouse.held) {
    for (let i=0;i<3;i++) emitParticle(mouse.x, mouse.y, s.mode);
  }
  for (const p of pPool) {
    if (!p.active) continue;
    if (p.type==='fire') p.vy -= 0.1; else p.vy += 0.08;
    p.x+=p.vx; p.y+=p.vy;
    if (--p.life<=0) p.active=false;
  }
  if (s.modesSeen.size>=3 && !s.won) s.won=true;
  return s;
}