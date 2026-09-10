function triggerStorm() {
  if (gameState._stormPhase !== 'none') return; // already storming
  gameState.stormActive = true;
  gameState._stormPhase = 'warning';
  gameState._stormTimer = 0;
  gameState._stormPhaseDur = 60 + Math.random() * 60; // 60-120s warning
  gameState._stormIntensity = 0;
  gameState._stormWarnShown = false;
}