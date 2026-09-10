function fulfillJGContract(idx) {
  const c = jgActiveContracts[idx];
  if (!c) return;
  if (!c.accepted) { showMsg('📜 Accept the contract first.'); return; }
  const have = countItem(c.crop);
  if (have < c.qty) {
    showMsg(`⚠️ Need ${c.qty - have} more ${ITEMS[c.crop]?.name || c.crop}.`);
    return;
  }
  removeItem(c.crop, c.qty);
  const onTime = gameState.day <= c.deadline;
  const earned = c.reward + (onTime ? c.bonus : 0);
  player.gold += earned;
  trackGoldEarned(earned);
  gainRep('jungle', 4 + Math.floor(earned / 200));
  jgContractStreak++;
  jgCompletedContracts.push({ ...c, completedDay: gameState.day, earned, onTime });
  jgActiveContracts.splice(idx, 1);
  spawnParticles(player.x, player.y, '#70c080', 6, '+$' + earned);
  const bonus = onTime ? ' (on-time bonus!)' : '';
  showMsg(`📜 Settlement contract complete! Earned $${earned.toLocaleString()}${bonus}`);
  // Check settlement rewards immediately
  _checkSettlementRewards();
  _renderJGContractBoard();
}