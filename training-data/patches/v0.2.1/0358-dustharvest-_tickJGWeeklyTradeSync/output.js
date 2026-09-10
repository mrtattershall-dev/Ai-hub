function _tickJGWeeklyTradeSync() {
  if (typeof gameState._jgDebt === 'undefined') return; // not in jungle arc yet
  const week = getJGWeekNumber(gameState.day);
  if (week === (gameState._lastTradeSync || 0)) return;
  gameState._lastTradeSync = week;

  // Jungle goods get modest demand bump on frontier
  const jungleExotics = ['jaguarPelt','serpentVenom','spiderSilk','eagleFeather',
                         'heartleaf','crimsonBloom','jungleBanana','canopyMelon',
                         'jgWood','jgHerb','jgMushroom','boarHide','boarTusk'];
  for (const id of jungleExotics) {
    if (economy.mult[id] !== undefined) {
      // Each week Tobias arrives, exotic demand ticks up slightly
      economy.mult[id] = Math.min(1.5, (economy.mult[id] || 1) + 0.04);
    }
  }

  // Frontier staples get slight scarcity bump in jungle context
  // (more people in jungle = more demand for frontier goods Tobias imports)
  // Uses economy.mult so the bump survives stepEconomy's price recalculation.
  const frontierStaples = ['bread','coal','ironBar','cloth','rope'];
  for (const id of frontierStaples) {
    if (economy.mult[id] !== undefined) {
      economy.mult[id] = Math.min(1.4, (economy.mult[id] || 1) + 0.03);
    }
  }
}