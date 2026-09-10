function _tickJungleDebtDawn() {
  if (!gameState.inJungle && typeof gameState._jgDebt === 'undefined') return;
  if (typeof gameState._jgDebt === 'undefined') return;
  generateJGWeeklyBills(gameState.day);

  const week = getJGWeekNumber(gameState.day);
  const start = gameState._jgDebtStartDay || gameState.day;

  // 5% daily interest on unpaid minimums past their due date
  let totalInterest = 0;
  for (const bill of jgWeeklyBills) {
    if (bill.paid || bill.due >= gameState.day) continue;
    const shortfall = bill.minPayment - (bill.paidAmount || 0);
    if (shortfall <= 0) { bill.paid = true; continue; }
    const interest = Math.round(shortfall * 0.05);
    if (interest > 0) {
      bill.minPayment += interest;
      gameState._jgDebt = Math.min(JG_DEBT_TOTAL * 1.5, gameState._jgDebt + interest);
      totalInterest += interest;
    }
  }
  if (totalInterest > 0)
    showMsg(`🌿 🏦 $${totalInterest.toLocaleString()} in Bond interest added — Altaverde doesn't wait.`);

  // Warning: upcoming minimum payment
  const nextBill = jgWeeklyBills.find(b => !b.paid && b.due >= gameState.day);
  if (nextBill && (nextBill.due - gameState.day) <= 2) {
    showMsg(`🌿 ⏰ Bond minimum payment of $${nextBill.minPayment.toLocaleString()} due in ${nextBill.due - gameState.day} day${nextBill.due - gameState.day !== 1 ? 's' : ''} — talk to Tobias.`);
  }

  // Altaverde re-entry threat if 2+ weeks overdue
  const overdueWeeks = jgWeeklyBills.filter(b => !b.paid && (b.due + JG_DEBT_WEEK_LENGTH * 2) <= gameState.day).length;
  if (overdueWeeks > 0 && !gameState._jgAltaverdeWarned) {
    gameState._jgAltaverdeWarned = true;
    showMsg(`🌿 ⚠️ ALTAVERDE NOTICE — two weeks of unpaid minimums. They have legal right to resume operations in the cleared zone.`);
  }
}