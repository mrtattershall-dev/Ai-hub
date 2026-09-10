function updateEnemies(dt){
  const px=G.px, py=G.py;
  for(let i=G.enemies.length-1;i>=0;i--){
    const e=G.enemies[i];
    const dx=px-e.x, dy=py-e.y, dist=Math.hypot(dx,dy)||1;

    // ── Charger ──
    if(e.type==='charger'){
      if(!e.charging){
        e.chargeWait-=dt;
        if(dist<230 && e.chargeWait<=0){
          e.charging=true;
          e.cdx=dx/dist; e.cdy=dy/dist;
          e.chargeT=0.6;
          boom(e.x,e.y,8,C.gold,{spd:80,settles:false}); // wind-up flash
        }
      } else {
        const nx=e.x+e.cdx*e.spd*2.4*dt, ny=e.y+e.cdy*e.spd*2.4*dt;
        if(canMove(nx,ny,e.sz)){ e.x=nx; e.y=ny; }
        else { e.charging=false; e.chargeWait=rng(1.2,2.0); }
        addSat(e.x,e.y,2*dt*60); // leaves rouge trail
        e.chargeT-=dt;
        if(e.chargeT<=0){ e.charging=false; e.chargeWait=rng(1.2,2.0); }
      }
    }
    // ── Revenant (elite): teleports to player ──
    else if(e.type==='revenant'){
      e.teleWait=(e.teleWait||rng(1.5,3))-dt;
      if(e.teleWait<=0 && dist<350){
        // Wind-up: flash
        e.teleT=(e.teleT||0)+dt;
        if(e.teleT<0.3){
          if(G.ticks%5<3) boom(e.x,e.y,4,'#8a0a5a',{settles:false,spd:80});
        } else {
          // Teleport — rouge explosion at origin, land near player
          boom(e.x,e.y,30,C.rouge,{settles:true,spd:180});
          addSat(e.x,e.y,15);
          const ang=Math.random()*Math.PI*2;
          e.x=G.px+Math.cos(ang)*(G.psize+e.sz+12);
          e.y=G.py+Math.sin(ang)*(G.psize+e.sz+12);
          boom(e.x,e.y,12,'#8a0a5a',{settles:false,spd:100});
          e.teleWait=rng(2.5,4); e.teleT=0;
        }
      } else {
        e.teleT=0;
        // Drift toward player between teleports
        if(dist>30){
          const nx=e.x+(dx/dist)*e.spd*dt, ny=e.y+(dy/dist)*e.spd*dt;
          if(canMove(nx,ny,e.sz)){ e.x=nx; e.y=ny; }
        }
      }
    }
    // ── Architect (elite): builds temp walls, fires ranged ──
    else if(e.type==='architect'){
      // Ranged attack
      e.shotT=(e.shotT||rng(1,2))-dt;
      if(e.shotT<=0 && dist<320){
        spawnProj(e.x,e.y,px,py,e.dmg,false,'#2a5a8a');
        e.shotT=rng(1.8,3.5);
      }
      // Build temp wall
      e.buildT=(e.buildT||rng(2,4))-dt;
      if(e.buildT<=0){
        const mx2=Math.floor((e.x/2+G.px/2)/TILE), my2=Math.floor((e.y/2+G.py/2)/TILE);
        // Don't block start room (rooms[0])
        const sr0=G.rooms[0];
        const inStart=sr0&&mx2>=sr0.x-1&&mx2<=sr0.x+sr0.w&&my2>=sr0.y-1&&my2<=sr0.y+sr0.h;
        if(!inStart && mx2>0&&mx2<COLS-1&&my2>0&&my2<ROWS-1 && G.map[my2][mx2]===T.FLOOR){
          G.map[my2][mx2]=T.WALL;
          G.sat[my2][mx2]=0;
          boom(mx2*TILE+TILE/2,my2*TILE+TILE/2,10,C.iron,{settles:false,spd:70});
        }
        e.buildT=rng(3,5);
      }
      // Drift away from player
      if(dist<160){ e.x-=(dx/dist)*e.spd*dt; e.y-=(dy/dist)*e.spd*dt; }
      else if(dist>280){ e.x+=(dx/dist)*e.spd*0.5*dt; e.y+=(dy/dist)*e.spd*0.5*dt; }
    }
    // ── Spitter ──
    else if(e.type==='spitter'){
      // Keep distance
      if(dist<100){ e.x-=(dx/dist)*e.spd*dt; e.y-=(dy/dist)*e.spd*dt; }
      else if(dist>200){ e.x+=(dx/dist)*e.spd*0.5*dt; e.y+=(dy/dist)*e.spd*0.5*dt; }
      e.shotT=(e.shotT||rng(1,2))-dt;
      if(e.shotT<=0&&dist<300){
        spawnProj(e.x,e.y,px,py,e.dmg||8,false,'#6aaa44');
        addSat(px,py,4); // spitter inadvertently paints tiles
        e.shotT=rng(1.5,3.0);
      }
    }
    // ── All other types: chase ──
    else {
      if(dist>6){
        const nx=e.x+(dx/dist)*e.spd*dt, ny=e.y+(dy/dist)*e.spd*dt;
        if(canMove(nx,ny,e.sz)){       e.x=nx; e.y=ny; }
        else if(canMove(nx,e.y,e.sz)){ e.x=nx; }
        else if(canMove(e.x,ny,e.sz)){ e.y=ny; }
        else { // unstuck: random push
          e.x+=rng(-40,40)*dt;
          e.y+=rng(-40,40)*dt;
        }
      }
    }

    // ── Contact damage (ALL enemy types including charger) ──
    // Uses iframes so multiple enemies can't all hit simultaneously
    if(e.contactDmg && dist < e.sz+G.psize+2){
      if(G.iframes<=0){
        let hit=Math.min(e.dmg, e.dmg*0.5);
        // Tumor-Chassis: absorb 10 damage per hit
        if(G.grafts[0]==='ORG-08'||G.grafts[1]==='ORG-08'){
          hit=Math.max(0,hit-10);
          boom(G.px,G.py,6,'#7a2a8a',{settles:false,spd:60});
          // SYNERGY: tumor_jaw — reflect heals player
          if(G.synergy==='tumor_jaw') G.rouge=Math.min(G.maxRouge,G.rouge+5);
          // Reflect 5 dmg to attacker
          e.hp-=5;
          if(e.hp<=0){ killEnemy(i); continue; }
        }
        G.rouge=Math.max(0,G.rouge-hit);
        G.iframes=0.4;
        G.shakeMag=Math.max(G.shakeMag,5);
        boom(G.px,G.py,8,C.rouge,{settles:false,spd:80,up:true});
      }
    }

    // ── Leech: latches and drains rouge directly ──
    if(e.leech && dist < e.sz+G.psize+4){
      if(G.iframes<=0){
        G.rouge=Math.max(0,G.rouge-18*dt);
        G.iframes=0.12; // short iframe window — leech is punishing but not instant-kill
        if(G.ticks%20===0) boom(G.px,G.py,4,'#4a1a3a',{settles:false,spd:50,up:true});
      }
    }
  }

  // ── Spore Vent AOE: active vents damage all enemies within 80px ──
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(G.map[r][c]===T.SPORE_VENT && G.ventActive[r*1000+c]){
        const vx=c*TILE+TILE/2, vy=r*TILE+TILE/2;
        // Tick every ~0.5s using ticks modulo (roughly 30 frames at 60fps)
        if(G.ticks%30===0){
          for(let i=G.enemies.length-1;i>=0;i--){
            const e=G.enemies[i];
            if(Math.hypot(e.x-vx,e.y-vy)<80){
              hitEnemy(i,8);
              boom(e.x,e.y,5,'#6aaa44',{settles:false,spd:70});
            }
          }
          // Visual spore burst from vent
          boom(vx,vy,8,'#6aaa44',{settles:false,spd:90,up:true});
        }
      }
    }
  }
}