function _checkSettlementRewards() {
  if (!gameState.inJungle) return;
  for (const reward of JG_SETTLEMENT_REWARDS) {
    if (gameState._jgRewardsClaimed.has(reward.id)) continue;
    let triggered = false;
    try { triggered = reward.check(); } catch(e) {}
    if (!triggered) continue;
    gameState._jgRewardsClaimed.add(reward.id);
    if (reward.gold > 0) player.gold += reward.gold;
    gainRep('jungle', reward.rep);
    showMsg(reward.msg);
    if (reward.gold > 0) {
      spawnParticles(player.x, player.y, '#70c080', 5, '+$' + reward.gold);
    }
  }
}