function launch(){
  initState();
  generateMap();
  spawnEnemies();
  setupInput();
  updateSynergyHUD();
  updateBossHUD();
  const label=G.floor===5?'FLOOR 05 — THE AMALGAM':G.floor===10?'FLOOR 10 — SINGULARITY':'FLOOR '+String(G.floor).padStart(2,'0');
  document.getElementById('floorIndicator').textContent=label;
  G.running=true;
  lastTs=performance.now();
  requestAnimationFrame(loop);
}