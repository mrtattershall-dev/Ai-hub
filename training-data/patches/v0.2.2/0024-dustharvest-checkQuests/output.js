function checkQuests() {
  // Mark any active quest whose progress has hit goal as claimable
  for (const q of activeQuests) {
    const progress = getQuestStat(q.stat) - q.startVal;
    if (progress >= q.goal && !claimableQuests.includes(q.id)) {
      claimableQuests.push(q.id);
      showMsg(`✅ Quest ready to claim: ${q.icon} ${q.title}!`);
    }
  }
}