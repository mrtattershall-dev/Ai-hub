function onBLEnemyKilled(typeKey) {
  blBountyKills[typeKey] = (blBountyKills[typeKey]||0) + 1;
  trackKill(typeKey);
  // Milestone — dust devil lore unlocked at 15 kills
  if (typeKey === 'dustDevil' && (stats.kills['dustDevil']||0) === 15) {
    setTimeout(() => showMsg(`🌪️ Crane is watching you from the outpost. Something in his expression changed.`), 1500);
  }
  blBounties.forEach(b => {
    if (b.complete) return;
    if (b.target === typeKey) {
      b.progress = Math.min(b.qty, (blBountyKills[typeKey]||0));
      if (b.progress >= b.qty && !b.complete) {
        b.complete = true;
        showMsg(`📋 Bounty complete: ${b.label}! Collect reward at the Wanted Board.`);
        spawnParticles(player.x, player.y, '#f0d060', 6, '📋');
      }
    }
  });
}