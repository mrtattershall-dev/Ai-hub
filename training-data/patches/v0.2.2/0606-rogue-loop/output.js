function loop(ts){
  if(!G.running) return;
  // dt in SECONDS, capped at 50ms to prevent spiral-of-death on tab switch
  const dt=Math.min((ts-lastTs)/1000, 0.05);
  lastTs=ts;
  G.time+=dt; G.ticks++;

  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateProjectiles(dt);
  if(G.boss){ if(G.boss.type==='amalgam') updateAmalgam(dt); else updateSovereignCore(dt); }

  // Organ drop timer
  for(let i=G.organDrops.length-1;i>=0;i--){
    G.organDrops[i].timer-=dt;
    if(G.organDrops[i].timer<=0) G.organDrops.splice(i,1);
  }

  const drain=updateDrain(dt);

  // Heartbeat audio
  G.hbTimer-=dt;
  if(G.hbTimer<=0){
    const rf=G.rouge/G.maxRouge;
    G.hbTimer=rf<0.15?0.35 : rf<0.3?0.65 : 2.0;
    if(rf<0.3) playSound('hb');
  }

  render();
  updateHUD(drain);

  // Death
  if(G.rouge<=0){
    G.running=false;
    // Save persistent stats on death
    try {
      const prev={ bestFloor:parseInt(localStorage.getItem('re_bestFloor')||'0'), lifeOrgans:parseInt(localStorage.getItem('re_lifeOrgans')||'0'), lifeTiles:parseInt(localStorage.getItem('re_lifeTiles')||'0'), runs:parseInt(localStorage.getItem('re_runs')||'0') };
      localStorage.setItem('re_bestFloor', Math.max(prev.bestFloor,G.floor));
      localStorage.setItem('re_lifeOrgans',prev.lifeOrgans+G.graftsEquipped);
      localStorage.setItem('re_lifeTiles', prev.lifeTiles+G.tilesTransformed);
      localStorage.setItem('re_runs',      prev.runs+1);
    } catch(e){}
    document.getElementById('deathScreen').style.display='flex';
    document.getElementById('dstats').innerHTML=
      `FLOOR ${G.floor}<br>${G.kills} ENEMIES KILLED<br>`+
      `${G.graftsEquipped} ORGANS GRAFTED<br>${G.tilesTransformed} TILES TRANSFORMED`;
    return;
  }
  requestAnimationFrame(loop);
}