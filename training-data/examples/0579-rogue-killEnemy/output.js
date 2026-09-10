function killEnemy(idx){
  const e=G.enemies[idx];
  G.enemies.splice(idx,1);
  boom(e.x,e.y,40,C.rouge,{spd:160,settles:true});
  boom(e.x,e.y,15,C.bright,{spd:220,settles:true});
  // Organ drop (separate from corpse siphon — both exist simultaneously)
  G.organDrops.push({ x:e.x, y:e.y, org:e.org, timer:4.0, maxTimer:4.0, id:Math.random() });
  // Corpse for rouge siphon — offset slightly so player can grab organ first
  G.corpses.push({ x:e.x, y:e.y, rv:e.rv, siphoned:false });
  G.kills++;
  // Myoblast-Jaw passive kill heal
  if(G.grafts[0]==='ORG-06'||G.grafts[1]==='ORG-06')
    G.rouge=Math.min(G.maxRouge,G.rouge+30);
  // Hemorrhage-Fist kill explosion
  if(G.grafts[0]==='ORG-10'){
    for(let a=0;a<24;a++){
      const ang=(a/24)*Math.PI*2;
      addSat(e.x+Math.cos(ang)*50, e.y+Math.sin(ang)*50, 8);
      boom(e.x,e.y,2,C.rouge,{settles:true,spd:200});
    }
  }
  // SYNERGY: acid_fist — kill leaves a permanent acid pool (boosts saturation ring)
  if(G.synergy==='acid_fist'){
    for(let a=0;a<16;a++){
      const ang=(a/16)*Math.PI*2;
      addSat(e.x+Math.cos(ang)*38, e.y+Math.sin(ang)*38, 12);
    }
    boom(e.x,e.y,18,'#aacc22',{settles:true,spd:140});
  }
  playSound('kill');
}