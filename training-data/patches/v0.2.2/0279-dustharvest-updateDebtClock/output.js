function updateDebtClock() {
  const clock   = document.getElementById('debtClock');
  if (!clock) return;
  const labelEl = document.getElementById('debtClockLabel');
  const amtEl   = document.getElementById('debtClockAmt');
  const nextEl  = document.getElementById('debtClockNext');
  const fill    = document.getElementById('debtClockFill');

  // ── Jungle mode — show the Land Restoration Bond ────────────────────────
  if (gameState.inJungle) {
    if (labelEl) labelEl.textContent = 'BOND DEBT';
    clock.style.borderLeftColor = '#40a060';
    clock.style.borderColor     = 'rgba(50,140,80,.43)';
    if (fill) fill.style.background = 'linear-gradient(90deg,#30a060,#60d080)';
    const jgDebt = getJGTotalDebt();
    if (typeof gameState._jgDebt === 'undefined') {
      amtEl.textContent = 'NO BOND YET';
      amtEl.classList.add('clear');
      if (nextEl) nextEl.textContent = 'Talk to Tobias to start';
      if (fill)   fill.style.width = '0%';
    } else if (jgDebt <= 0) {
      amtEl.textContent = 'BOND CLEARED';
      amtEl.classList.add('clear');
      amtEl.style.color = '#60d040';
      if (nextEl) nextEl.textContent = '✓ Territory is free';
      if (fill)   fill.style.width = '0%';
    } else {
      amtEl.textContent = '$' + jgDebt.toLocaleString();
      amtEl.classList.remove('clear');
      const week   = typeof getJGWeekNumber === 'function' ? getJGWeekNumber(gameState.day) : 1;
      const bill   = jgWeeklyBills && jgWeeklyBills.find(b => b.week === week);
      const minDue = bill && !bill.paid ? Math.max(0, bill.minPayment - (bill.paidAmount || 0)) : 0;
      const overdue = jgWeeklyBills ? jgWeeklyBills.filter(b => !b.paid && b.due < gameState.day && (b.paidAmount || 0) < b.minPayment).length : 0;
      if (overdue > 0) {
        amtEl.style.color = '#e04040';
        if (nextEl) { nextEl.textContent = `⚠ ${overdue} minimum overdue`; nextEl.style.color = '#e07020'; }
      } else {
        amtEl.style.color = '#60b880';
        if (nextEl) { nextEl.style.color = ''; nextEl.textContent = minDue > 0 ? `Min due: $${minDue.toLocaleString()}` : `Week ${week} / ${JG_DEBT_TOTAL_WEEKS}`; }
      }
      const pct = Math.max(0, Math.min(100, (1 - jgDebt / JG_DEBT_TOTAL) * 100));
      if (fill) fill.style.width = pct + '%';
    }
    return;
  }

  // ── Frontier mode — restore default styling and show land debt ─────────
  if (labelEl) labelEl.textContent = 'LAND DEBT';
  clock.style.borderLeftColor = '';
  clock.style.borderColor     = '';
  if (fill) fill.style.background = '';

  generateWeeklyBills(gameState.day);
  const debt = getTotalDebt();

  if (debt <= 0 && weeklyBills.length > 0) {
    amtEl.textContent = 'PAID IN FULL';
    amtEl.classList.add('clear');
    nextEl.textContent = '';
    if (fill) fill.style.width = '0%';
  } else {
    amtEl.textContent = '$' + debt.toLocaleString();
    amtEl.classList.remove('clear');

    // Overdue warning: any bill unpaid for 1+ week shows urgent state
    const overdueOne = weeklyBills.filter(b => !b.paid && (b.due + DEBT_WEEK_LENGTH) <= gameState.day);
    const overdueTwo = weeklyBills.filter(b => !b.paid && (b.due + DEBT_WEEK_LENGTH * 2) <= gameState.day);
    if (getDifficultyConfig().enemySpawn !== false && overdueOne.length > 0) {
      const weeksLeft = overdueTwo.length > 0 ? '⚠ FORECLOSURE IMMINENT' : `⚠ ${overdueOne.length} bill${overdueOne.length>1?'s':''} overdue — pay now`;
      nextEl.textContent = weeksLeft;
      nextEl.style.color = overdueTwo.length > 0 ? '#e03030' : '#e07020';
      amtEl.style.color = '#e04040';
    } else {
      amtEl.style.color = '';
      nextEl.style.color = '';
      // Days until next bill — don't show phantom week 25+ bill
      const currentWeek  = getWeekNumber(gameState.day);
      const nextWeek     = currentWeek + 1;
      if (nextWeek > DEBT_TOTAL_WEEKS) {
        nextEl.textContent = 'Final week — clear the balance';
      } else {
        const nextBillDay  = (nextWeek - 1) * DEBT_WEEK_LENGTH + 1;
        const daysLeft     = nextBillDay - gameState.day;
        const nextAmt      = getWeeklyBillAmount(nextWeek);
        nextEl.textContent = `+$${nextAmt} in ${daysLeft}d`;
      }
    }

    // Fill bar: week progress
    const weekPct = ((gameState.day - 1) % DEBT_WEEK_LENGTH) / DEBT_WEEK_LENGTH * 100;
    if (fill) fill.style.width = weekPct + '%';
  }
}