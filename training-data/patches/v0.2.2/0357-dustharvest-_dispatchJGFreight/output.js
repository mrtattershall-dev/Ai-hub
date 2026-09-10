function _dispatchJGFreight() {
  const log = gameState._jgFreightLog || {};
  const items = Object.entries(log).filter(([, q]) => q > 0);
  if (!items.length) return;

  const week = getJGWeekNumber(gameState.day);
  if (week === gameState._jgFreightWeek) return;
  gameState._jgFreightWeek = week;

  const total = items.reduce((sum, [id, qty]) => sum + (_getJGExportPrice(id) * qty), 0);
  const topItem = items.sort((a, b) => b[1] - a[1])[0];
  const topName = ITEMS[topItem[0]]?.name || topItem[0];
  showMsg(`📦 Tobias freighted your goods to the frontier. Top cargo: ${topName} ×${topItem[1]}. Est. value: $${total.toLocaleString()}.`);

  // Apply jungle supply shock to frontier economy for sold items
  for (const [itemId, qty] of items) {
    if (economy.mult[itemId] !== undefined) {
      // Increased supply → slight price depression on frontier (demand met)
      const shock = Math.min(0.15, qty * 0.01);
      economy.mult[itemId] = Math.max(0.7, (economy.mult[itemId] || 1) - shock);
    }
  }

  // Reset weekly log
  gameState._jgFreightLog = {};
}