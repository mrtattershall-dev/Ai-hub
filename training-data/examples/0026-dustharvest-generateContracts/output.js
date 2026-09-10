function generateContracts(day) {
  // Purge expired contracts first
  expireContracts(day);
  while (activeContracts.length < 3) {
    const slotIdx = activeContracts.length + day * 3; // stable slot seed
    // Pure ore buyer: appears once player has mine rep 3+ and has mined pure ore
    const mineRep = (typeof REPUTATION !== 'undefined' && REPUTATION.mine) || 0;
    const hasPureOre = gameState._mineLastHaul && Object.values(gameState._mineLastHaul).some(h => h.pure > 0);
    const pureContractSlot = activeContracts.length === 0 && mineRep >= 3 && hasPureOre && (day % 4 === 0);
    let c;
    if (pureContractSlot) {
      c = _generatePureOreContract(day, slotIdx);
    } else {
      c = generateOneContract(day, slotIdx);
    }
    // Apply streak bonus if pending
    if (streakBonus) {
      c.hasStreakBonus = true;
      streakBonus = false;
    }
    activeContracts.push(c);
  }
}