function refreshDebtHUD() {
  const el = document.getElementById('debtDisp');
  if (!el) return;
  const debt = getTotalDebt();
  if (debt <= 0 && weeklyBills.length >= DEBT_TOTAL_WEEKS) {
    el.textContent = '🏦 DEBT FREE';
    el.style.color = '#60d040';
    el.style.borderColor = 'rgba(60,200,40,.5)';
  } else if (debt <= 0 && weeklyBills.length > 0) {
    el.textContent = '🏦 Paid ahead';
    el.style.color = '#90c060';
    el.style.borderColor = 'rgba(100,160,40,.4)';
  } else {
    el.textContent = `🏦 $${debt.toLocaleString()}`;
    const nextWeek = getWeekNumber(gameState.day) + 1;
    if (nextWeek <= DEBT_TOTAL_WEEKS) {
      const nextBill = getWeeklyBillAmount(nextWeek);
      el.title = `Next bill (Week ${nextWeek}): $${nextBill}`;
    } else {
      el.title = 'Final week — clear your balance';
    }
    el.style.color  = debt > 500 ? '#e07050' : debt > 200 ? '#d0a030' : '#80d060';
    el.style.borderColor = debt > 500 ? 'rgba(200,60,40,.4)' : debt > 200 ? 'rgba(200,160,40,.4)' : 'rgba(60,200,40,.4)';
  }
  // Also keep the debt clock widget in sync
  if (typeof updateDebtClock === 'function') updateDebtClock();
}