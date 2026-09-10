function _handleBLMineNPCInteraction() {
  if (!gameState.inBLMine) return false;
  const fl = gameState.blMineFloor;
  if (blMineNPCTalkOpen) { closeBLMineNPCTalk(); return true; }
  for (const npc of BL_MINE_NPCS) {
    if (npc.floor !== fl) continue;
    const nx = npc.tx * T + T/2;
    const ny = npc.ty * T + T/2;
    if (Math.hypot(player.x - nx, player.y - ny) < T*2.5) {
      openBLMineNPCTalk(npc.id, 'root');
      return true;
    }
  }
  return false;
}