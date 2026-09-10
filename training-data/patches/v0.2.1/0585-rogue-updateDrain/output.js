function updateDrain(dt){
  let drain=G.baseDrain * (1+(G.floor-1)*0.08);
  const o0=ORGANS[G.grafts[0]], o1=ORGANS[G.grafts[1]];
  if(o0) drain*=o0.drainMult;
  if(o1) drain*=o1.drainMult;

  G.rouge=Math.max(0,G.rouge-drain*dt);

  // Graft decay — count down in seconds
  for(let i=0;i<2;i++){
    if(!G.grafts[i]) continue;
    G.graftDecay[i]-=dt;
    if(G.graftDecay[i]<=0){
      boom(G.px,G.py,20,C.necro,{spd:160,settles:false});
      G.grafts[i]=''; G.graftDecay[i]=0;
      playSound('decay');
      resolveSynergy();
      updateSynergyHUD();
    }
  }
  return drain;
}