function isStormsheltered() {
  // In sub-zones storms don't apply — always sheltered there
  if (gameState.inMine || gameState.inBLMine || gameState.inBadlands || gameState.inHoboCamp || gameState.inOcean || gameState.inJungle) return true;
  // On TOWN_FLOOR or PEN_FLOOR tile = indoors
  const tx = Math.floor(player.x / T), ty = Math.floor(player.y / T);
  const t = getT(tx, ty);
  if (t === TL.TOWN_FLOOR || t === TL.PEN_FLOOR) return true;
  // Adjacent to 2+ solid walls = sheltered
  let wallCount = 0;
  for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nt = getT(tx+dx, ty+dy);
    if (nt === TL.WALL || nt === TL.BUILDING || nt === TL.BARN_CLOSED) wallCount++;
  }
  if (wallCount >= 2) return true;
  // Manual shelter choice (encounter panel) — treated as a one-time hint,
  // but auto-cleared once player moves more than 3 tiles from where they sheltered
  if (gameState.stormSheltering) {
    if (!gameState._shelterTX) { gameState._shelterTX = tx; gameState._shelterTY = ty; }
    if (Math.abs(tx - gameState._shelterTX) > 3 || Math.abs(ty - gameState._shelterTY) > 3) {
      gameState.stormSheltering = false; gameState._shelterTX = 0; gameState._shelterTY = 0;
    } else {
      return true;
    }
  }
  return false;
}