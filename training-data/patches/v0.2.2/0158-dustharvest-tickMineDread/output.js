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
  // Burn torch timer — one torch lasts 90 seconds
  if (countItem('torch') > 0 && !player._mineLantern && gameState._candleBurnLeft <= 0) {
    gameState._torchBurnLeft = (gameState._torchBurnLeft || 0) - dt;
    if (gameState._torchBurnLeft <= 0) {
      removeItem('torch', 1);
      gameState._torchBurnLeft = countItem('torch') > 0 ? 90 : 0;
      if (countItem('torch') > 0) showMsg(`🔦 Torch burned out — lit next one. ${countItem('torch')} remaining.`);
      else showMsg('🔦 Last torch burned out. The dark closes in.');
    }
  } else if (player._mineLantern || gameState._candleBurnLeft > 0) {
    gameState._torchBurnLeft = 90; // reset torch timer if switching to better light
  }
  if (player._mineLantern) {
    // Lantern fully suppresses dread (but floor 4 fights back slowly)
    const suppressRate = fl === 3 ? 4 : 25;
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * suppressRate);
  } else if (gameState._candleBurnLeft > 0) {
    // Candle: strong suppression, nearly as good as lantern
    const suppressRate = fl === 3 ? 2 : 18;
    gameState._mineDread = Math.max(0, gameState._mineDread - dt * suppressRate);
  } else if (countItem('torch') > 0) {
    // Torch: moderate suppression — slows dread but doesn't fully stop it on deep floors
    const suppressRate = fl === 3 ? -2 : fl === 2 ? 8 : 15;
    gameState._mineDread = suppressRate < 0
      ? Math.min(100, gameState._mineDread + dt * Math.abs(suppressRate))
      : Math.max(0, gameState._mineDread - dt * suppressRate);
  } else {
    // No light: fill fast (faster on deep floors)
    const fillRate = fl === 3 ? 12 : fl === 2 ? 8 : 6;
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