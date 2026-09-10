function claimQuest(questId) {
  const idx = activeQuests.findIndex(q => q.id === questId);
  if (idx === -1) return;
  const q = activeQuests[idx];
  const progress = getQuestStat(q.stat) - q.startVal;
  if (progress < q.goal) { showMsg('⚠️ Quest not complete yet.'); return; }

  player.gold += q.reward;
  trackGoldEarned(q.reward);
  if (q.rep) gainRep(q.rep, 8);
  spawnParticles(player.x, player.y, '#f0d060', 8, '+$'+q.reward);
  showMsg(`✅ Quest complete: ${q.icon} ${q.title} — +$${q.reward}!`);

  completedQuests.push({ ...q, claimedDay: gameState.day });
  claimableQuests = claimableQuests.filter(id => id !== questId);
  activeQuests.splice(idx, 1);

  // Rotate in the next available quest
  const doneIds = new Set(completedQuests.map(cq => cq.id));
  const next = QUEST_POOL.find(p => !doneIds.has(p.id) && !activeQuests.find(a => a.id === p.id));
  if (next) activeQuests.push({ ...next, startVal: getQuestStat(next.stat) });

  refreshMarketUI();
}