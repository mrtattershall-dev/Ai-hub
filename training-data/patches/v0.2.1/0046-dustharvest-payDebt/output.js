function payDebt(amount) {
  const totalDebt = getTotalDebt();
  if (totalDebt <= 0) { showMsg('No outstanding debt — you\'re clear!'); return; }
  if (player.gold < amount) { showMsg(`⚠️ Need $${amount} — you only have $${player.gold}.`); return; }
  let remaining = Math.min(amount, totalDebt);
  const actual = remaining;
  player.gold -= actual;
  trackGoldSpent(actual);
  stats.debtRepaid += actual;
  debtPaidLog.push({ day: gameState.day, amount: actual });

  // Pay off oldest unpaid bills first
  let leftToPay = actual;
  for (const bill of weeklyBills) {
    if (bill.paid || leftToPay <= 0) continue;
    if (leftToPay >= bill.amount) {
      leftToPay -= bill.amount;
      bill.paid = true;
    } else {
      // Partial payment — split the bill
      bill.amount -= leftToPay;
      leftToPay = 0;
    }
  }

  spawnParticles(player.x, player.y, '#e07050', 6, `-$${actual}`);
  const allWeeksBilled = weeklyBills.length >= DEBT_TOTAL_WEEKS;
  if (getTotalDebt() <= 0 && allWeeksBilled) {
    triggerDebtFreeEnding();
  } else if (getTotalDebt() <= 0) {
    showMsg(`🏦 Paid $${actual.toLocaleString()} — all current bills cleared. More weeks ahead.`);
  } else {
    showMsg(`🏦 Paid $${actual.toLocaleString()} — $${getTotalDebt().toLocaleString()} remaining.`);
  }
  refreshDebtHUD();
  updateDebtClock();   // ← keep debt clock HUD in sync immediately after payment
  refreshMarketUI();
}