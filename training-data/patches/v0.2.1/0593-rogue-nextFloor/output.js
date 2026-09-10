function nextFloor(){
  G.floor++;
  if(G.floor>10) return; // run ends at boss kill, not here
  G.rouge=Math.min(G.maxRouge,G.rouge+45);
  if(G.floor===10){
    generateBossArena();
  } else {
    generateMap();
  }
  spawnEnemies();
  G.particles=[]; G.projectiles=[]; G.corpses=[]; G.organDrops=[];
  G.boss=null; G.bossPhase=0;
  G.secretDropSpawned=false;
  graftCooldown=0;
  const label=G.floor===5?'FLOOR 05 — THE AMALGAM':G.floor===10?'FLOOR 10 — SINGULARITY':'FLOOR '+String(G.floor).padStart(2,'0');
  document.getElementById('floorIndicator').textContent=label;
  updateBossHUD();
}