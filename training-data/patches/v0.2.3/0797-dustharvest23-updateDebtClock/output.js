function updateDebtClock() {
  const clock = document.getElementById('debtClock');
  if (!clock) return;
  generateWeeklyBills(gameState.day);
  const debt = getTotalDebt();
  const amtEl = document.getElementById('debtClockAmt');
  const nextEl = document.getElementById('debtClockNext');
  const fill   = document.getElementById('debtClockFill');

  if (debt <= 0 && weeklyBills.length > 0) {
    amtEl.textContent = 'PAID IN FULL';
    amtEl.classList.add('clear');
    nextEl.textContent = '';
    if (fill) fill.style.width = '0%';
  } else {
    amtEl.textContent = '$' + debt.toLocaleString();
    amtEl.classList.remove('clear');

    // Days until next bill
    const currentWeek  = getWeekNumber(gameState.day);
    const nextWeek     = currentWeek + 1;
    const nextBillDay  = (nextWeek - 1) * DEBT_WEEK_LENGTH + 1;
    const daysLeft     = nextBillDay - gameState.day;
    const nextAmt      = getWeeklyBillAmount(nextWeek);
    nextEl.textContent = `+$${nextAmt} in ${daysLeft}d`;

    // Fill bar: week progress
    const weekPct = ((gameState.day - 1) % DEBT_WEEK_LENGTH) / DEBT_WEEK_LENGTH * 100;
    if (fill) fill.style.width = weekPct + '%';
  }
}