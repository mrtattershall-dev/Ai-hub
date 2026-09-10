function getSaveInfo() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    const bills = d.weeklyBills || [];
    const debt = bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);
    const debtStr = debt <= 0 ? 'DEBT FREE' : `$${debt.toLocaleString()} owed`;
    return `Day ${d.day} · $${d.player.gold} · ${debtStr}`;
  } catch(e) { return ''; }
}