function updateStormOverlay() {
  const ov = document.getElementById('stormOverlay');
  if (!ov) return;
  const intensity = gameState._stormIntensity || 0;
  // FIX: never show overlay in sub-zones
  if (intensity < 0.1 || gameState.inMine || gameState.inBLMine || gameState.inBadlands || gameState.inHoboCamp || gameState.inOcean || gameState.inJungle) {
    ov.className = ''; return;
  }
  ov.className = isStormsheltered() ? 'sheltered' : (intensity > 0.5 ? 'exposed' : '');
}