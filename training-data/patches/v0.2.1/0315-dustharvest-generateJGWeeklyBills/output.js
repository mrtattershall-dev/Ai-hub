function generateJGWeeklyBills(day) {
  if (typeof gameState._jgDebt === 'undefined') return;
  const currentWeek = getJGWeekNumber(day);
  const start = gameState._jgDebtStartDay || day;
  for (let w = 1; w <= Math.min(currentWeek, JG_DEBT_TOTAL_WEEKS); w++) {
    if (jgWeeklyBills.find(b => b.week === w)) continue;
    const minPay = getJGWeeklyMinPayment(w);
    const due = start + (w - 1) * JG_DEBT_WEEK_LENGTH;
    jgWeeklyBills.push({ week: w, minPayment: minPay, due, paid: false, paidAmount: 0 });
  }
}