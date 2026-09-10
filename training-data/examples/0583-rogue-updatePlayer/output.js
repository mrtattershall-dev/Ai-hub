function updatePlayer(dt){
  const k=G.keys;
  let dx=0, dy=0;
  if(k['w']||k['ArrowUp'])    dy=-1;
  if(k['s']||k['ArrowDown'])  dy= 1;
  if(k['a']||k['ArrowLeft'])  dx=-1;
  if(k['d']||k['ArrowRight']) dx= 1;
  if(dx&&dy){ dx*=0.707; dy*=0.707; }

  // Speed lane: saturated floor tiles give 1.75x speed
  const pc=Math.floor(G.px/TILE), pr=Math.floor(G.py/TILE);
  const satHere = (pr>=0&&pr<ROWS&&pc>=0&&pc<COLS) ? G.sat[pr][pc] : 0;
  const onLane = G.map[pr]&&G.map[pr][pc]===T.FLOOR && satHere>20;
  const hasNeuron=(G.grafts[0]==='ORG-09'||G.grafts[1]==='ORG-09');
  const spd = G.pspeed * (onLane?1.75:1) * (hasNeuron?1.1:1);

  const nx=G.px+dx*spd*dt, ny=G.py+dy*spd*dt;
  if(canMove(nx, G.py, G.psize)) G.px=Math.max(5,Math.min(W-5,nx));
  if(canMove(G.px, ny, G.psize)) G.py=Math.max(5,Math.min(H-5,ny));

  // Corpse siphon — walk over, instant +rouge
  for(let i=G.corpses.length-1;i>=0;i--){
    const corp=G.corpses[i];
    if(!corp.siphoned && Math.hypot(G.px-corp.x,G.py-corp.y)<32){
      corp.siphoned=true;
      G.rouge=Math.min(G.maxRouge,G.rouge+corp.rv);
      boom(corp.x,corp.y,18,C.rouge,{settles:false,up:true,spd:110});
      G.corpses.splice(i,1);
    }
  }

  // Secret room: drop an elite organ when player first enters
  if(G.secretRoom && !G.secretDropSpawned){
    const sr=G.secretRoom;
    const inRoom=(G.px>sr.x*TILE && G.px<(sr.x+sr.w+3)*TILE && G.py>sr.y*TILE && G.py<(sr.y+sr.h+3)*TILE);
    if(inRoom){
      G.secretDropSpawned=true;
      const eliteOrgs=['ORG-01','ORG-06','ORG-10','ORG-08','ORG-05','ORG-09'];
      const drop=eliteOrgs[Math.floor(Math.random()*eliteOrgs.length)];
      G.organDrops.push({ x:(sr.x+2)*TILE+TILE/2, y:(sr.y+1)*TILE+TILE/2, org:drop, timer:12.0, maxTimer:12.0, id:Math.random() });
      boom((sr.x+2)*TILE+TILE/2,(sr.y+1)*TILE+TILE/2,20,C.gold,{settles:false,spd:140,up:true});
    }
  }

  // Passive healing on hyper-saturated floor (>90 sat)
  if(pr>=0&&pr<ROWS&&pc>=0&&pc<COLS && G.map[pr][pc]===T.FLOOR && satHere>90)
    G.rouge=Math.min(G.maxRouge,G.rouge+2*dt);

  // Corpse Pit: stand on it for strong rouge regen (+8/sec)
  if(pr>=0&&pr<ROWS&&pc>=0&&pc<COLS && G.map[pr][pc]===T.CORPSE_PIT){
    G.rouge=Math.min(G.maxRouge, G.rouge+8*dt);
    // Emit small blood particles upward to signal the regen
    if(G.ticks%18===0) boom(G.px,G.py,3,C.rouge,{settles:false,up:true,spd:60,sz:1.5});
  }

  // Organ pickup
  if(graftCooldown>0) graftCooldown-=dt;
  checkGraftPickup();

  // Attack cooldown
  if(G.attackCd>0)  G.attackCd-=dt;
  if(G.iframes>0)   G.iframes-=dt;

  // Floor exit — guard against firing every frame; block while boss alive
  if(!G.floorTransitioning && !G.boss && tileAt(G.px,G.py)===T.EXIT){
    G.floorTransitioning=true;
    nextFloor();
  }
}