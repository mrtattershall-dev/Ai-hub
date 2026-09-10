function spawnEnemies(){
  G.enemies=[];
  G.boss=null; G.bossPhase=0;

  // ── Floor 10: Sovereign Core boss ───────────────────────────
  if(G.floor===10){
    spawnSovereignCore();
    updateBossHUD();
    return;
  }

  const stdPool=['husk','spitter','charger','crawler','leech','brute'];
  const elitePool=['revenant','architect'];
  const count=Math.min(4+G.floor*2,20);
  const typePool= G.floor===1 ? ['husk','husk','husk','spitter'] : stdPool;

  for(let i=0;i<count;i++){
    const type=typePool[Math.floor(Math.random()*typePool.length)];
    const def=ETYPES[type];
    const roomIdx=1+Math.floor(Math.random()*(G.rooms.length-1));
    const room=G.rooms[Math.min(roomIdx,G.rooms.length-1)];
    const ex=room.x*TILE+rng(TILE*0.5,room.w*TILE-TILE*0.5);
    const ey=room.y*TILE+rng(TILE*0.5,room.h*TILE-TILE*0.5);
    G.enemies.push({
      ...def, type,
      x:ex, y:ey,
      hp:def.hp*(1+(G.floor-1)*0.1),
      maxHp:def.hp*(1+(G.floor-1)*0.1),
      charging:false, chargeWait:rng(0.5,2), chargeT:0, cdx:0, cdy:0,
      shotT:rng(1,2.5), teleWait:rng(1.5,3), teleT:0, buildT:rng(2,4),
    });
  }

  const eliteCount = G.floor>=6 ? 2 : G.floor>=3 ? 1 : 0;
  for(let e=0;e<eliteCount;e++){
    const type=elitePool[e%elitePool.length];
    const def=ETYPES[type];
    const room=G.rooms[G.rooms.length-1];
    const ex=room.x*TILE+rng(TILE,room.w*TILE-TILE);
    const ey=room.y*TILE+rng(TILE,room.h*TILE-TILE);
    G.enemies.push({
      ...def, type,
      x:ex, y:ey,
      hp:def.hp*2.5*(1+(G.floor-1)*0.1),
      maxHp:def.hp*2.5*(1+(G.floor-1)*0.1),
      charging:false, chargeWait:rng(0.5,2), chargeT:0, cdx:0, cdy:0,
      shotT:rng(1,2), teleWait:rng(1.5,3), teleT:0, buildT:rng(2,4),
    });
  }

  // ── Floor 5: The Amalgam mini-boss (alongside standard enemies) ──
  if(G.floor===5){
    spawnAmalgam();
    updateBossHUD();
  }
}