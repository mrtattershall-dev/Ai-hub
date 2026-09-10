function enterDeepJungle() {
  if (!_deepMapBuilt) buildDeepJungleMap();
  gameState.inDeepJungle = true;
  gameState.inJungle     = false; // exclusive — can only be in one zone
  // Place player at ASCEND tiles (top of deep map)
  player.x = 40.5 * DJ_T;
  player.y = 2    * DJ_T;
  // Reveal starting area
  _revealDeepArea(40, 2, 6);
  showMsg('🌿 You descend into the deep jungle. The air changes. Something ancient watches from the canopy.');
  setTimeout(() => {
    if (gameState.inDeepJungle)
      showMsg('💀 Hessa\'s people say the formation lies deeper south. The Verdant Court is said to be near it.');
  }, 4000);
}