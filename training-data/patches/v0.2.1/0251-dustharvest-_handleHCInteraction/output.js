function _handleHCInteraction() {
  if (!gameState.inHoboCamp) return false;
  if (hcTalkOpen) { closeHCTalk(); return true; }
  // Find closest NPC within talk radius
  for (const npc of HC_NPCS) {
    if (npc.id === 'hc_young' && hcTalkSeen.has('kit_left_camp')) continue; // Kit's gone
    const nx = npc.tx * HC_T + HC_T/2;
    const ny = npc.ty * HC_T + HC_T/2;
    if (Math.hypot(player.x - nx, player.y - ny) < 72) {
      openHCTalk(npc.id, 'root');
      return true;
    }
  }
  return false;
}