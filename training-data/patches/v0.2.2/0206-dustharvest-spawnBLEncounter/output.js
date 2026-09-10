function spawnBLEncounter() {
  if (!gameState.inBadlands) return;
  if (activeEncounter) return;
  if (encounterCooldownDay >= gameState.day) return;
  if (Math.random() > 0.45) return;
  const enc = BL_ENCOUNTER_POOL[Math.floor(Math.random()*BL_ENCOUNTER_POOL.length)];
  activeEncounter = enc;
  showEncounterPanel(enc);
  encounterCooldownDay = gameState.day + 1;
}