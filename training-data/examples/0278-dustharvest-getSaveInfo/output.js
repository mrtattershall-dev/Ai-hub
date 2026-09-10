function getSaveInfo(slot) {
  try {
    const d = JSON.parse(localStorage.getItem(saveKey(slot)));
    if (!d) return null;
    const bills = d.weeklyBills || [];
    const debt = bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);
    const debtStr = debt <= 0 ? 'DEBT FREE' : `$${debt.toLocaleString()} owed`;
    const name = (d.player && d.player.name) ? d.player.name : 'Stranger';
    return `${name} · Day ${d.day} · $${d.player.gold} · ${debtStr}`;
  } catch(e) { return null; }
}