function payJGDebt(amount) {
  if (getJGTotalDebt() <= 0) { showMsg('🌿 The Land Restoration Bond is cleared.'); return; }
  if (player.gold < amount) { showMsg(`⚠️ Need $${amount.toLocaleString()} — you have $${player.gold.toLocaleString()}.`); return; }
  const actual = Math.min(amount, getJGTotalDebt());
  player.gold -= actual;
  gameState._jgDebt = Math.max(0, gameState._jgDebt - actual);
  jgDebtPaidLog.push({ day: gameState.day, amount: actual });

  // Mark minimum payment satisfied for this week's bill
  const week = getJGWeekNumber(gameState.day);
  const bill = jgWeeklyBills.find(b => b.week === week);
  if (bill && !bill.paid) {
    bill.paidAmount = (bill.paidAmount || 0) + actual;
    if (bill.paidAmount >= bill.minPayment) bill.paid = true;
  }

  spawnParticles(player.x, player.y, '#70c080', 6, `-$${actual.toLocaleString()}`);

  if (gameState._jgDebt <= 0) {
    gameState._jgDebtFree = true;
    jungleTalkSeen.add('jg_debt_cleared');
    showMsg('🌿 THE LAND RESTORATION BOND IS CLEARED. The territory is free.');
    gainRep('jungle', 30);
  } else {
    showMsg(`🌿 Paid $${actual.toLocaleString()} toward the Bond. $${gameState._jgDebt.toLocaleString()} remaining.`);
  }
  _renderTobiasDockPanel(); // refresh if open
}