function _renderDebtStatement(ov) {
  if (typeof gameState._jgDebt === 'undefined') {
    ov.innerHTML = '<div style="color:#506040;font-size:9px;padding:10px;">Bond not yet initialised — talk to Tobias.</div>';
    return;
  }
  generateJGWeeklyBills(gameState.day);

  const currentWeek = getJGWeekNumber(gameState.day);
  const totalPaid   = getJGTotalPaid();
  const remaining   = getJGTotalDebt();
  const projected   = (() => {
    // Sum of all future minimums — what the player still owes in minimums
    let sum = 0;
    for (let w = currentWeek; w <= JG_DEBT_TOTAL_WEEKS; w++) {
      sum += getJGWeeklyMinPayment(w);
    }
    return sum;
  })();

  // Summary header
  let html = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">📋 Land Restoration Bond — Full Statement</div>
    <div style="background:rgba(200,80,20,.06);border:1px solid rgba(200,80,20,.2);border-radius:3px;padding:8px 10px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:9px;color:#a08060;">Total Bond</span>
        <span style="font-size:11px;color:#d4b870;font-family:'Special Elite',serif;">$${JG_DEBT_TOTAL.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:9px;color:#a08060;">Paid to date</span>
        <span style="font-size:11px;color:#60d040;font-family:'Special Elite',serif;">$${totalPaid.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:9px;color:#a08060;">Remaining principal</span>
        <span style="font-size:11px;color:${remaining > 50000 ? '#e06040' : '#c0d060'};font-family:'Special Elite',serif;">$${remaining.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:9px;color:#605030;">Week ${currentWeek} of ${JG_DEBT_TOTAL_WEEKS}</span>
        <span style="font-size:9px;color:#605030;">Min remaining: ~$${projected.toLocaleString()}</span>
      </div>
    </div>

    <div style="font-size:9px;color:#608050;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase;">Weekly Schedule</div>
    <div style="font-size:8px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px;color:#506040;margin-bottom:4px;padding:0 2px;">
      <span>Week</span><span>Minimum</span><span>Due Day</span><span>Status</span>
    </div>`;

  const bills = [...jgWeeklyBills].sort((a, b) => a.week - b.week);
  const unpaidBills = bills.filter(b => !b.paid);
  const paidBills   = bills.filter(b => b.paid);

  // Show unpaid first, then paid (collapsed if many)
  const toShow = [...unpaidBills, ...paidBills.slice(-5)];
  for (const bill of toShow) {
    const overdue  = !bill.paid && bill.due < gameState.day;
    const upcoming = !bill.paid && bill.due >= gameState.day && (bill.due - gameState.day) <= 3;
    const shortfall = bill.minPayment - (bill.paidAmount || 0);
    const statusColor = bill.paid ? '#60a040' : overdue ? '#e04040' : upcoming ? '#e0b040' : '#607050';
    const status = bill.paid
      ? `✓ PAID`
      : overdue
        ? `OVERDUE -$${shortfall.toLocaleString()}`
        : upcoming
          ? `DUE DAY ${bill.due}`
          : `Day ${bill.due}`;
    html += `<div style="font-size:8px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px;padding:3px 2px;border-bottom:1px solid rgba(80,160,60,.07);">
      <span style="color:#708060;">W${bill.week}</span>
      <span style="color:#908060;">$${bill.minPayment.toLocaleString()}</span>
      <span style="color:#607050;">${bill.due}</span>
      <span style="color:${statusColor};font-size:7.5px;">${status}</span>
    </div>`;
  }

  if (paidBills.length > 5) {
    html += `<div style="font-size:8px;color:#405030;padding:3px 2px;font-style:italic;">…and ${paidBills.length - 5} more paid weeks</div>`;
  }

  // Recent payment log
  if (jgDebtPaidLog.length > 0) {
    html += `<div style="font-size:9px;color:#508050;margin-top:8px;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase;">Payment Log</div>`;
    [...jgDebtPaidLog].reverse().slice(0, 6).forEach(e => {
      html += `<div style="font-size:8px;color:#607050;padding:2px 0;border-bottom:1px solid rgba(80,160,60,.05);">Day ${e.day}: -$${e.amount.toLocaleString()}</div>`;
    });
  }

  html += `<button onclick="_jgPanelTab='bank';_renderTobiasDockPanel()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">← BACK TO BOND PAYMENT</button>`;

  ov.innerHTML = html;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}