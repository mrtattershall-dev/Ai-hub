function updateSovereignCore(dt){
  const b=G.boss;
  if(!b||b.type!=='sovereign') return;
  const dx=G.px-b.x, dy=G.py-b.y, dist=Math.hypot(dx,dy)||1;

  // Rotate arms
  b.armAngs=b.armAngs.map(a=>a+b.rotSpd*dt);

  // Phase transitions
  if(b.phase===1 && b.hp<=840){ b.phase=2; G.bossPhase=2; boom(b.x,b.y,60,C.rouge,{spd:240,settles:true}); playSound('decay'); }
  if(b.phase===2 && b.hp<=480){ b.phase=3; G.bossPhase=3; boom(b.x,b.y,80,C.bright,{spd:280,settles:true}); playSound('decay'); b.rotSpd=2.4; }

  // Chase (all phases)
  if(!b.charging && dist>30){
    const nx=b.x+(dx/dist)*b.spd*dt, ny=b.y+(dy/dist)*b.spd*dt;
    if(canMove(nx,ny,b.sz)){ b.x=nx; b.y=ny; }
    else if(canMove(nx,b.y,b.sz)){ b.x=nx; }
    else if(canMove(b.x,ny,b.sz)){ b.y=ny; }
  }

  // ── Phase 1: continuously summons Husks ──────────────────────
  if(b.phase===1){
    b.summonT-=dt;
    if(b.summonT<=0){
      const count=2+Math.floor(b.hp/400);
      for(let i=0;i<count;i++){
        const ang=Math.random()*Math.PI*2;
        G.enemies.push({ ...ETYPES.husk, type:'husk', x:b.x+Math.cos(ang)*100, y:b.y+Math.sin(ang)*100,
          hp:40, maxHp:40, charging:false,chargeWait:1,chargeT:0,cdx:0,cdy:0,shotT:2,teleWait:2,teleT:0,buildT:3 });
      }
      boom(b.x,b.y,20,C.iron,{spd:120,settles:false});
      b.summonT=rng(3,5);
    }
    // Ranged projectile burst
    if(G.ticks%90===0){
      for(let i=0;i<4;i++){
        const a=Math.atan2(dy,dx)+(i-1.5)*0.35;
        spawnProj(b.x,b.y, b.x+Math.cos(a)*200, b.y+Math.sin(a)*200, 18, false, C.bright);
      }
    }
  }

  // ── Phase 2: rouge-shift attacks — saturates tiles to create hazards ─
  if(b.phase===2){
    b.shiftT-=dt;
    if(b.shiftT<=0){
      // Saturate a ring of tiles around player to create speed lanes for itself
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2;
        addSat(G.px+Math.cos(a)*TILE*3, G.py+Math.sin(a)*TILE*3, 25);
      }
      // Fire 8-way projectile burst
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2;
        spawnProj(b.x,b.y, b.x+Math.cos(a)*200, b.y+Math.sin(a)*200, 20, false, '#8a0a5a');
      }
      boom(b.x,b.y,30,'#8a0a5a',{spd:200,settles:true});
      b.shiftT=rng(2.5,4);
    }
    // Continues summoning, less frequently
    b.summonT-=dt;
    if(b.summonT<=0){
      const ang=Math.random()*Math.PI*2;
      G.enemies.push({ ...ETYPES.husk, type:'husk', x:b.x+Math.cos(ang)*80, y:b.y+Math.sin(ang)*80,
        hp:40,maxHp:40,charging:false,chargeWait:1,chargeT:0,cdx:0,cdy:0,shotT:2,teleWait:2,teleT:0,buildT:3 });
      b.summonT=rng(5,8);
    }
  }

  // ── Phase 3: steals organs, gains their abilities ────────────
  if(b.phase===3){
    b.stealT-=dt;
    if(b.stealT<=0 && b.stolenOrgs.length<3){
      // Rip organ from player if they have one
      const graftIdx=G.grafts[0]?0:G.grafts[1]?1:-1;
      if(graftIdx>=0 && dist<220){
        const stolen=G.grafts[graftIdx];
        b.stolenOrgs.push(stolen);
        G.grafts[graftIdx]=''; G.graftDecay[graftIdx]=0;
        resolveSynergy(); updateSynergyHUD();
        boom(b.x,b.y,30,ORGANS[stolen]?.col||C.rouge,{spd:180,settles:false});
        boom(G.px,G.py,20,C.necro,{spd:120,settles:false,up:true});
        playSound('decay');
        G.shakeMag=12;
      }
      b.stealT=rng(4,7);
    }
    // For each stolen organ: boss gains an attack based on it
    if(G.ticks%45===0){
      for(const org of b.stolenOrgs){
        const o=ORGANS[org];
        if(!o) continue;
        if(o.type==='ranged'){
          spawnProj(b.x,b.y,G.px,G.py,o.dmg*1.2,false,o.col||C.bright);
        } else if(o.type==='melee' && dist<120){
          if(G.iframes<=0){ G.rouge=Math.max(0,G.rouge-o.dmg); G.iframes=0.35; G.shakeMag=8; boom(b.x,b.y,15,o.col||C.rouge,{settles:true,spd:150}); }
        }
      }
    }
    // Phase 3 charge attack
    if(!b.charging){ b.chargeT=(b.chargeT||0)-dt; }
    if(!b.charging && (b.chargeT||0)<=0 && dist<300){
      b.charging=true; b.cdx=dx/dist; b.cdy=dy/dist; b.chargeT=0.7; b.spd=160;
      boom(b.x,b.y,10,C.bright,{spd:100,settles:false});
    }
    if(b.charging){
      const nx=b.x+b.cdx*b.spd*dt, ny=b.y+b.cdy*b.spd*dt;
      if(canMove(nx,ny,b.sz)){ b.x=nx; b.y=ny; }
      else { b.charging=false; b.spd=44; b.chargeT=rng(3,5); }
      b.chargeT-=dt;
      if(b.chargeT<=0){ b.charging=false; b.spd=44; b.chargeT=rng(3,5); }
    }
  }

  // Contact damage
  if(dist < b.sz+G.psize+2 && G.iframes<=0){
    let hit=25;
    if(G.grafts[0]==='ORG-08'||G.grafts[1]==='ORG-08'){ hit=Math.max(0,hit-10); if(G.synergy==='tumor_jaw') G.rouge=Math.min(G.maxRouge,G.rouge+5); }
    G.rouge=Math.max(0,G.rouge-hit); G.iframes=0.6; G.shakeMag=14;
    boom(G.px,G.py,12,C.rouge,{settles:false,spd:100,up:true});
  }

  // Death — massive rouge flood, win state
  if(b.hp<=0){
    G.running=false;
    // Flood every tile
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) G.sat[r][c]=100;
    render(); // one last frame showing the flood
    boom(b.x,b.y,120,C.rouge,{spd:280,settles:true});
    boom(b.x,b.y,60,C.bright,{spd:340,settles:true});
    G.kills++;
    G.boss=null; G.bossPhase=0;
    setTimeout(()=>showWinScreen(), 1400);
    return;
  }

  // Boss bar update
  updateBossHUD();
}