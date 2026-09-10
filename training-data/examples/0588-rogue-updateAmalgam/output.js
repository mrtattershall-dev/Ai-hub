function updateAmalgam(dt){
  const b=G.boss;
  if(!b||b.type!=='amalgam') return;
  const dx=G.px-b.x, dy=G.py-b.y, dist=Math.hypot(dx,dy)||1;

  // Chase
  if(dist>20){
    const nx=b.x+(dx/dist)*b.spd*dt, ny=b.y+(dy/dist)*b.spd*dt;
    if(canMove(nx,ny,b.sz)){ b.x=nx; b.y=ny; }
    else if(canMove(nx,b.y,b.sz)){ b.x=nx; }
    else if(canMove(b.x,ny,b.sz)){ b.y=ny; }
  }
  // Leave massive rouge trails
  if(G.ticks%4===0) addSat(b.x+rng(-b.sz,b.sz),b.y+rng(-b.sz,b.sz),3);

  // Phase transition
  if(b.phase===1 && b.hp<=200){
    b.phase=2; G.bossPhase=2;
    boom(b.x,b.y,50,C.rouge,{spd:200,settles:true});
    playSound('decay');
  }

  // Phase 1: tendril pull attack
  if(b.phase===1){
    b.pullT-=dt;
    if(b.pullT<=0 && dist<350){
      // Pull player toward Amalgam
      const pullF=260;
      G.px+=(dx/dist)*-pullF*0.12; // nudge player toward boss
      G.py+=(dy/dist)*-pullF*0.12;
      boom(b.x,b.y,20,C.rouge,{settles:true,spd:180});
      boom(G.px,G.py,8,C.rouge,{settles:false,spd:80,up:true});
      if(G.iframes<=0){ G.rouge=Math.max(0,G.rouge-8); G.iframes=0.5; G.shakeMag=6; }
      b.pullT=rng(2.5,4);
    }
  }

  // Phase 2: shed organs as homing projectiles + faster trails
  if(b.phase===2){
    b.shedT-=dt;
    if(b.shedT<=0){
      // Fire a tendril projectile toward player
      const orgIds=Object.keys(ORGANS);
      const randOrg=orgIds[Math.floor(Math.random()*orgIds.length)];
      spawnProj(b.x,b.y,G.px,G.py,14,false,ORGANS[randOrg]?.col||C.rouge);
      addSat(b.x,b.y,8);
      boom(b.x,b.y,12,C.necro,{spd:150,settles:true});
      b.shedT=rng(0.8,1.8);
    }
    // In phase 2 the organ sheds ALSO drop graftable pickups occasionally
    if(G.ticks%90===0){
      const orgIds=Object.keys(ORGANS);
      const randOrg=orgIds[Math.floor(Math.random()*orgIds.length)];
      G.organDrops.push({ x:b.x+rng(-60,60), y:b.y+rng(-60,60), org:randOrg, timer:2.0, maxTimer:2.0, id:Math.random() });
    }
  }

  // Contact damage
  if(dist < b.sz+G.psize+2 && G.iframes<=0){
    let hit=20;
    if(G.grafts[0]==='ORG-08'||G.grafts[1]==='ORG-08'){ hit=Math.max(0,hit-10); if(G.synergy==='tumor_jaw') G.rouge=Math.min(G.maxRouge,G.rouge+5); }
    G.rouge=Math.max(0,G.rouge-hit); G.iframes=0.5; G.shakeMag=10;
  }

  // Death
  if(b.hp<=0){
    boom(b.x,b.y,80,C.rouge,{spd:220,settles:true});
    boom(b.x,b.y,40,C.bright,{spd:280,settles:true});
    for(let a=0;a<20;a++) addSat(b.x+Math.cos(a/20*Math.PI*2)*80, b.y+Math.sin(a/20*Math.PI*2)*80, 15);
    G.rouge=Math.min(G.maxRouge,G.rouge+60); // boss kill reward
    G.kills++;
    // Drop a random elite organ
    const eliteOrgs=['ORG-01','ORG-06','ORG-10','ORG-08','ORG-05'];
    const drop=eliteOrgs[Math.floor(Math.random()*eliteOrgs.length)];
    G.organDrops.push({ x:b.x, y:b.y, org:drop, timer:8.0, maxTimer:8.0, id:Math.random() });
    G.boss=null; G.bossPhase=0;
    playSound('kill');
    updateBossHUD();
  }
}