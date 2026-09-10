function hitEnemy(idx,dmg){
  if(idx<0||idx>=G.enemies.length) return;
  const e=G.enemies[idx];
  const hasCrit=(G.grafts[0]==='ORG-07'||G.grafts[1]==='ORG-07');
  let d=dmg;
  if(hasCrit&&Math.random()<0.4){
    d*=2;
    boom(e.x,e.y,20,C.bright,{settles:true,spd:200});
    // SYNERGY: crit_gatling — fire two extra projectiles outward on crit
    if(G.synergy==='crit_gatling'){
      const a=Math.atan2(e.y-G.py, e.x-G.px);
      spawnProj(G.px,G.py,e.x+Math.cos(a+0.6)*200,e.y+Math.sin(a+0.6)*200,ORGANS['ORG-01'].dmg,true,C.bright);
      spawnProj(G.px,G.py,e.x+Math.cos(a-0.6)*200,e.y+Math.sin(a-0.6)*200,ORGANS['ORG-01'].dmg,true,C.bright);
    }
  }
  e.hp-=d;
  boom(e.x,e.y,12,C.rouge,{settles:true});
  G.shakeMag=Math.max(G.shakeMag,2);
  if(e.hp<=0) killEnemy(idx);
}