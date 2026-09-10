function initQuests() {
  // Build the first 3 active quests from the pool, skipping any already done
  const doneIds = new Set(completedQuests.map(q => q.id));
  const pool    = QUEST_POOL.filter(q => !doneIds.has(q.id));
  while (activeQuests.length < 3 && pool.length > 0) {
    const q = pool.shift();
    activeQuests.push({ ...q, startVal: getQuestStat(q.stat) });
  }
}