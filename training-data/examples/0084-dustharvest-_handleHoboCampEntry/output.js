function _handleHoboCampEntry() {
  if (gameState.inHoboCamp) {
    // Don't trigger exit if an NPC is in range — let _handleHCInteraction handle it
    const nearNPC = HC_NPCS.some(npc => {
      const nx=npc.tx*HC_T+HC_T/2, ny=npc.ty*HC_T+HC_T/2;
      return Math.hypot(player.x-nx, player.y-ny) < 72;
    });
    if (nearNPC) return false;
    for (const [cx,cy] of playerAdjacentTiles()) {
      if (getHCT(cx,cy) === HC.EXIT) { exitHoboCamp(); return true; }
    }
    if (player.y >= (HC_H-2)*HC_T) { exitHoboCamp(); return true; }
    return false;
  }
  for (const [cx,cy] of playerAdjacentTiles()) {
    if (getT(cx,cy) === TL.HOBO_PORTAL) { enterHoboCamp(); return true; }
  }
  return false;
}