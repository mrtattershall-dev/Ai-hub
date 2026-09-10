function expireContracts(day) {
  const expired = activeContracts.filter(c => c.deadline < day);
  if (expired.length === 0) return;
  for (const c of expired) {
    if (c.accepted) {
      // Accepted and failed — consequences apply
      const who = c.title.includes('Mill') ? 'The miller' :
                  c.title.includes('Fish') ? 'The buyer' :
                  c.title.includes('Camp') ? 'The contact' : 'The client';
      showMsg(`📜 ${who} moved on — contract failed: ${c.icon} ${c.title}`);
      gainRep('town', -5);
      missedContracts++;
      contractStreak = 0;
      streakBonus = false;
    }
    // Unaccepted contracts just quietly rotate off — no message, no penalty
  }
  activeContracts = activeContracts.filter(c => c.deadline >= day);
}