function _handleJGInteraction() {
  if (!gameState.inJungle) return false;

  // Panel close takes highest priority
  if (_tobiasPanelOpen) { closeTobiasPanel(); return true; }
  if (jgTalkOpen)       { closeJGTalk();      return true; }

  // NPC proximity
  for (const npc of JG_NPCS) {
    const nx = npc.tx * JG_T + JG_T / 2;
    const ny = npc.ty * JG_T + JG_T / 2;
    if (Math.hypot(player.x - nx, player.y - ny) < 72) {
      openJGTalk(npc.id);
      return true;
    }
  }

  // Exit tile
  const ptx = Math.floor(player.x / JG_T);
  const pty = Math.floor(player.y / JG_T);
  if (getJGT(ptx, pty) === JG.EXIT || pty <= 1) {
    exitJungle();
    return true;
  }

  return false;
}