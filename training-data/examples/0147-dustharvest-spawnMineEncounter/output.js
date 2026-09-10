function spawnMineEncounter() {
  if (!gameState.inMine) return;
  if (_mineEncounterCooldown > 0) return;
  if (Math.random() > 0.35) return;
  _mineEncounterCooldown = 3;

  // Floor 4 gets its own encounter pool
  const pool = gameState.mineFloor === 3 ? MINE_ENCOUNTERS_F4 : MINE_ENCOUNTERS;
  const enc = pool[Math.floor(Math.random()*pool.length)];

  setTimeout(() => {
    showMsg(enc.msg, 4000);
    enc.reward();
  }, 2000 + Math.random()*3000);
}