function spawnEncounter() {
  // 'Mine' here = the overworld mine-entrance zone tile area, NOT the interior (gameState.inMine)
  if (gameState.zone!=='Wilderness' && gameState.zone!=='Mine') return;
  if (encounterCooldownDay >= gameState.day) return;
  if (activeEncounter) return;
  if (Math.random() > 0.55) return; // 55% chance each qualifying day
  const season = getCurrentSeason();
  // Weighted pool: increase storm weight based on season.stormChance
  const stormWeight  = Math.round((season.stormChance || 0.25) * 10); // e.g. winter=5.5, spring=1.5
  const otherWeight  = 1;
  const pool = [];
  for (const enc of ENCOUNTER_POOL) {
    const w = enc.id === 'storm' ? stormWeight : otherWeight;
    for (let i = 0; i < w; i++) pool.push(enc);
  }
  const enc = pool[Math.floor(Math.random()*pool.length)];
  activeEncounter = enc;
  if (enc.id==='storm') { triggerStorm(); }
  showEncounterPanel(enc);
  encounterCooldownDay = gameState.day + 1;
}