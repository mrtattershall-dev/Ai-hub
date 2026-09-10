function tickStorm(dt) {
  if (!gameState.stormActive && gameState._stormPhase === 'none') return;

  gameState._stormTimer += dt;

  if (gameState._stormPhase === 'warning') {
    gameState._stormIntensity = Math.min(0.15, gameState._stormTimer / gameState._stormPhaseDur * 0.15);
    if (!gameState._stormWarnShown) {
      gameState._stormWarnShown = true;
      showMsg('⛈ A dust wall is building on the horizon. Find shelter or push through.');
    }
    if (gameState._stormTimer >= gameState._stormPhaseDur) {
      gameState._stormPhase = 'building';
      gameState._stormTimer = 0;
      gameState._stormPhaseDur = 30 + Math.random() * 30; // 30-60s ramp up
    }
  } else if (gameState._stormPhase === 'building') {
    gameState._stormIntensity = 0.15 + (gameState._stormTimer / gameState._stormPhaseDur) * 0.7;
    if (gameState._stormTimer >= gameState._stormPhaseDur) {
      gameState._stormPhase = 'peak';
      gameState._stormTimer = 0;
      gameState._stormPhaseDur = 60 + Math.random() * 120; // 60-180s at peak
      showMsg('⛈ Storm at full strength. Visibility gone. Move slow or shelter up.');
    }
  } else if (gameState._stormPhase === 'peak') {
    gameState._stormIntensity = 0.85 + Math.sin(Date.now() * 0.0008) * 0.08; // breathes
    // Ongoing damage if unsheltered and outdoors
    if (!isStormsheltered() && !gameState.inMine && !gameState.inBLMine && !gameState.inBadlands && !gameState.inHoboCamp && !gameState.inOcean && !gameState.inJungle) {
      player.hp = Math.max(1, player.hp - 1.5 * dt);
      player.stamina = Math.max(0, player.stamina - 3 * dt);
    }
    if (gameState._stormTimer >= gameState._stormPhaseDur) {
      gameState._stormPhase = 'fading';
      gameState._stormTimer = 0;
      gameState._stormPhaseDur = 45 + Math.random() * 45;
      showMsg('🌤 The storm is breaking. Give it a minute.');
    }
  } else if (gameState._stormPhase === 'fading') {
    gameState._stormIntensity = 0.85 * (1 - gameState._stormTimer / gameState._stormPhaseDur);
    if (gameState._stormTimer >= gameState._stormPhaseDur) {
      gameState.stormActive = false;
      gameState.stormSheltering = false;
      gameState._stormPhase = 'none';
      gameState._stormIntensity = 0;
      gameState._stormTimer = 0;
      stats.stormsSurvived++;
      showMsg('🌤 Storm cleared. The dust settles.');
    }
  }
  updateStormOverlay();
}