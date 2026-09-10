function updateBadlandsEnemies(dt) {
  // Sync HUD every frame
  updateHeatHUD();
  // Continuous spawn in badlands (day and night)
  blNightSpawnTimer -= dt;
  if(blNightSpawnTimer<=0) {
    const spawnMult = getHeatTier().spawnMult;
    blNightSpawnTimer = (gameState.isNight ? 6+Math.random()*6 : 12+Math.random()*14) / spawnMult;
    spawnBadlandsEnemyNear();
  }

  for(let i=badlandsEnemies.length-1;i>=0;i--) {
    const e = badlandsEnemies[i];
    const def = BADLANDS_ENEMY_DEFS[e.type];
    if(!def){ badlandsEnemies.splice(i,1); continue; }

    const dx=player.x-e.x, dy=player.y-e.y;
    const dist=Math.hypot(dx,dy);

    // Cull if very far
    if(dist>700){ badlandsEnemies.splice(i,1); continue; }

    e.attackTimer=Math.max(0,e.attackTimer-dt);
    e.flashTimer=Math.max(0,(e.flashTimer||0)-dt);

    if(def.ai==='ambush'||def.ai==='circle') {
      // Ambush: hide until close, then charge
      if(dist>180&&e.state!=='chase') { e.state='idle'; continue; }
      e.state='chase';
    }

    // Vulture circles before diving
    if(def.ai==='circle'&&dist>120) {
      const angle=Math.atan2(dy,dx)+0.05;
      const mnx=e.x+Math.cos(angle)*def.speed*dt*0.8;
      const mny=e.y+Math.sin(angle)*def.speed*dt*0.8;
      // Collision: check BL_SOLID for each axis independently
      if(!BL_SOLID.has(getBLT(Math.floor(mnx/T),Math.floor(e.y/T)))) e.x=mnx;
      if(!BL_SOLID.has(getBLT(Math.floor(e.x/T),Math.floor(mny/T)))) e.y=mny;
    } else if(dist>def.range) {
      const mnx=e.x+dx/dist*def.speed*dt;
      const mny=e.y+dy/dist*def.speed*dt;
      // Full collision: try move, then slide on each axis
      if(!BL_SOLID.has(getBLT(Math.floor(mnx/T),Math.floor(mny/T)))) {
        e.x=mnx; e.y=mny;
      } else {
        if(!BL_SOLID.has(getBLT(Math.floor(mnx/T),Math.floor(e.y/T)))) e.x=mnx;
        if(!BL_SOLID.has(getBLT(Math.floor(e.x/T),Math.floor(mny/T)))) e.y=mny;
      }
    }

    // Clamp to badlands bounds
    e.x=Math.max(T,Math.min((BL_W-1)*T,e.x));
    e.y=Math.max(T,Math.min((BL_H-1)*T,e.y));

    // Attack
    if(dist<=def.range+4 && e.attackTimer<=0) {
      const armor=player._armor||0;
      const dmg=Math.max(1,Math.round(def.damage*getHeatTier().damageMult)-armor);
      damagePlayer(dmg, e.type);
      e.attackTimer=def.attackCd;
    }
  }
}