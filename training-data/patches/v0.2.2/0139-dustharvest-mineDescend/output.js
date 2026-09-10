function mineDescend() {
  if (gameState.mineFloor >= MINE_FLOORS - 1) { showMsg('⛏ No deeper shaft here. The stone is solid.'); return; }
  if (!isMineOpen()) { showMsg(`⛏ Shaft blocked — exit before dark! Mine closes at ${getMineHours()}.`); return; }
  gameState.mineFloor++;
  if (gameState.mineFloor > gameState._deepestMineFloor) {
    gameState._deepestMineFloor = gameState.mineFloor;
  }
  gainRep('mine', 2); // descending deeper shows commitment
  // Trusted mine rep: Silas's knowledge echoes — floor-specific hint
  if (getRepTier('mine') === 'trusted' || getRepTier('mine') === 'revered') {
    const _fl = gameState.mineFloor;
    const _hints = [
      null, // floor 0 — no hint needed
      "Silas's voice in your head: \"Iron runs east of the main shaft on this floor. Copper up top.\"",
      "You remember Silas: \"Gold veins on Floor 3 cluster near the south arm. Dark and quiet down there.\"",
      "Silas said never to investigate the vibration. He didn't say don't go looking."
    ];
    if (_hints[_fl]) setTimeout(() => showMsg('⛏ ' + _hints[_fl]), 1800);
  }
  appendMineJournal(`Day ${gameState.day} — Descended to Floor ${gameState.mineFloor + 1}.${gameState.mineFloor === 3 ? ' The Unmapped. Air here tastes different.' : ''}`);
  player.x = MINE_SPAWN[gameState.mineFloor].x;
  player.y = MINE_SPAWN[gameState.mineFloor].y;
  centerCameraOnPlayer();
  if (gameState.mineFloor === 3) {
    showMsg(`⛏ You drop through the broken stone into Floor 4 — The Unmapped. The air is wrong down here.`);
    setTimeout(() => { if (gameState.inMine && gameState.mineFloor === 3) showMsg('🪬 The walls hum. Not from the wind.'); }, 3500);
  } else {
    showMsg(`⛏ Descended to Floor ${gameState.mineFloor+1} — ${MINE_FLOOR_CFG[gameState.mineFloor].name}`);
  }
  dSound('night');
  updateMineHUD();
  setTimeout(() => { if (gameState.inMine) spawnMineEncounter(); }, 4000);
}