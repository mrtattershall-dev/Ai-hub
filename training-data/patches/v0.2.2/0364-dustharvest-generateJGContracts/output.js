function generateJGContracts(day) {
  if (typeof gameState._jgDebt === 'undefined') return; // not in jungle arc
  const maxContracts = 1 + Math.min(2, Math.floor(getRep('jungle') / 34)); // 1→2→3 with rep
  while (jgActiveContracts.length < maxContracts) {
    const slotIdx = jgActiveContracts.length + day * 5;
    jgActiveContracts.push(_generateJGContract(day, slotIdx));
  }
  // Expire old ones
  const expired = jgActiveContracts.filter(c => c.deadline < day);
  for (const c of expired) {
    if (c.accepted) {
      showMsg(`📜 Settlement contract expired: ${c.icon} ${c.title}. Kit noticed.`);
      gainRep('jungle', -3);
      jgContractStreak = 0;
    }
  }
  jgActiveContracts = jgActiveContracts.filter(c => c.deadline >= day);
}