function claimBLBounty(idx) {
  const b = blBounties[idx];
  if (!b || !b.complete) return;
  player.gold += b.reward;
  gainRep('badlands', 5); // bounty completion = local notoriety
  trackGoldEarned(b.reward);
  spawnParticles(player.x, player.y, '#f0d060', 8, '+$'+b.reward);
  showMsg(`💰 Bounty paid: $${b.reward} for ${b.label}!`);
  blBounties.splice(idx, 1);
  if (blBounties.length === 0) {
    showMsg('📋 All bounties cleared — new board tomorrow.');
    closeBLBountyBoard();
  } else {
    openBLBountyBoard(); // refresh
  }
  refreshInvUI();
}