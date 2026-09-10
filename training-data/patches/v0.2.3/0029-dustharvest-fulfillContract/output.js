function fulfillContract(idx) {
  const c = activeContracts[idx];
  if (!c.accepted) { showMsg(`📜 Accept the contract first before delivering.`); return; }
  const have = countItem(c.crop);
  if (have < c.qty) { showMsg(`⚠️ Need ${c.qty-have} more ${c.crop}.`); return; }
  // Pure ore contracts require pure-quality slots specifically
  if (c.pureOreRequired) {
    let pureCount = 0;
    const _eff = getEffectiveSlotCount();
    for (let i=0;i<_eff;i++) {
      const s = inventory.slots[i];
      if (s && s.itemId === c.crop && s.quality === 'pure') pureCount += s.qty;
    }
    if (pureCount < c.qty) {
      showMsg(`✨ Pure ore contract needs ${c.qty} pure-quality ${ITEMS[c.crop]?.name} — you only have ${pureCount} pure. Check your inventory quality.`);
      return;
    }
    // Consume pure units specifically
    let toRemove = c.qty;
    const _eff2 = getEffectiveSlotCount();
    for (let i=_eff2-1;i>=0 && toRemove>0;i--) {
      const s = inventory.slots[i];
      if (!s || s.itemId !== c.crop || s.quality !== 'pure') continue;
      const take = Math.min(s.qty, toRemove);
      s.qty -= take; toRemove -= take;
      if (s.qty <= 0) inventory.slots[i] = null;
    }
    refreshInvUI(); buildHotbar();
  } else {
    removeItem(c.crop, c.qty);
  }
  const onTime = gameState.day <= c.deadline;
  let earned = c.reward + (onTime ? c.bonus : 0);

  // Apply streak bonus if this contract was tagged at generation time
  const hadStreakBonus = c.hasStreakBonus;
  if (hadStreakBonus) earned = Math.round(earned * 1.2);

  player.gold += earned;
  trackGoldEarned(earned);
  stats.contractsCompleted++;
  gainRep('town', 3); // completing a contract boosts town rep

  // Update streak
  contractStreak++;
  if (contractStreak >= 3) {
    streakBonus = true; // next contract generated gets a 20% tag
  }

  const streakMsg   = hadStreakBonus ? ' 🔥 Streak bonus (+20%)!' : '';
  const onTimeMsg   = onTime && !hadStreakBonus ? ' (on-time bonus!)' : '';
  spawnParticles(player.x, player.y, '#f0d060', 8, '+$'+earned);
  showMsg(`📜 Contract complete! Earned $${earned}${onTimeMsg}${streakMsg}`);
  completedContracts.push({ ...c, completedDay:gameState.day, earned, onTime, hadStreakBonus });
  activeContracts.splice(idx, 1);
  refreshMarketUI();
  refreshInvUI();
  buildHotbar();
}