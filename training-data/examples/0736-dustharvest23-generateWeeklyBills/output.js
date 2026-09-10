function generateWeeklyBills(currentDay) {
  const currentWeek = getWeekNumber(currentDay);
  for (let w = 1; w <= currentWeek; w++) {
    if (!weeklyBills.find(b => b.week === w)) {
      const amount = getWeeklyBillAmount(w);
      weeklyBills.push({ week: w, amount, due: (w - 1) * DEBT_WEEK_LENGTH + 1, paid: false });
      if (w > 1) {  // Don't announce week 1 on game start
        showMsg(`🏦 Week ${w} bank payment due: $${amount}!`);
      }
    }
  }
}