function tickMineDread(dt) {
  if (!gameState.inMine) {
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * 20); // clear fast on exit
    _updateDreadHUD();
    return;
  }
  const fl = gameState.mineFloor;
  if (fl < 1) {
    // Floor 1 — no dread
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * 15);
    _updateDreadHUD();
    return;
  }
  const hasLight = player._mineLantern || gameState._candleBurnLeft > 0 || countItem('torch') > 0;
  // Burn candle timer
  if (gameState._candleBurnLeft > 0) {
    gameState._candleBurnLeft -= dt;
    if (gameState._candleBurnLeft <= 0) {
      gameState._candleBurnLeft = 0;
      showMsg('🕯️ Candle guttered out. The dark feels closer now.');
    }
  }
  if (player._mineLantern) {
    // Lantern fully suppresses dread (but floor 4 fights back slowly)
    const suppressRate = fl === 3 ? 4 : 25;
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * suppressRate);
  } else if (gameState._candleBurnLeft > 0) {
    // Candle: slow suppression
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * 10);
  } else if (countItem('torch') > 0) {
    // Torch: partial suppression — still fills but slowly
    const fillRate = fl === 3 ? 3.5 : 1.5;
    gameState._mineDread += dt * fillRate;
  } else {
    // No light: fill fast (faster on floor 3)
    const fillRate = fl === 3 ? 12 : 6;
    gameState._mineDread += dt * fillRate;
  }
  gameState._mineDread = Math.max(0, Math.min(100, gameState._mineDread));
  // Psychic damage at full dread
  if (gameState._mineDread >= 100) {
    _dreadDamageCooldown -= dt;
    if (_dreadDamageCooldown <= 0) {
      _dreadDamageCooldown = 4;
      damagePlayer(5, 'dread');
      player.stamina = Math.max(0, player.stamina - 8);
      showMsg('😰 The dark presses in — psychic damage! -5 HP, -8 stamina. Find light!');
    }
    // Movement slow: applied in movement code via gameState._mineDread check
  }
  _updateDreadHUD();
}