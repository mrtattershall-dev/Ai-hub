function _tickHollowedPassiveRaid() {
  if (!gameState.inJungle) return;
  if (getHollowedState() !== 'hostile') return;
  if (typeof gameState._jgDebt === 'undefined') return; // jungle arc not started

  const week = getJGWeekNumber(gameState.day) || 1;
  if (week < 2) return; // first week, no raids yet

  // 20% chance of minor crop damage per dawn (less than the full event's 35%)
  if (Math.random() > 0.20) return;

  let damaged = 0;
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled || !p.crop || p.wilted) continue;
    if (Math.random() < 0.20) { // 20% per plot
      p.wilted = true;
      damaged++;
    }
  }
  if (damaged > 0) {
    showMsg(`💀 Something moved through the cleared zone overnight. ${damaged} crop${damaged > 1 ? 's' : ''} wilted. The Hollowed are still watching.`);
  }
}