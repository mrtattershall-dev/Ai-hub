function initFog() {
  exploredWorld.fill(0);
  exploredMine.forEach(g => g.fill(0));
  exploredHobo.fill(0);
  // Pre-reveal spawn area and full farm zone on minimap
  revealAround(player.x, player.y, WORLD_REVEAL_RADIUS + 2, exploredWorld, MAP_W, MAP_H);
  // Mark all farm tiles and a buffer around them as explored
  for (let ty = 0; ty <= 34; ty++) {
    for (let tx = 0; tx <= 34; tx++) {
      exploredWorld[ty * MAP_W + tx] = 1;
    }
  }
  _minimapCacheDirty = true;
}