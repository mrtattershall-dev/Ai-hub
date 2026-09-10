function _stepJGMarketEvents() {
  if (typeof gameState._jgDebt === 'undefined') return;

  // Tick current event
  if (gameState._jgEvent) {
    gameState._jgEventDaysLeft--;
    if (gameState._jgEventDaysLeft <= 0) {
      const ev = JG_MARKET_EVENTS.find(e => e.id === gameState._jgEvent);
      // Hollowed raid: damage random crops at dawn
      if (ev && ev.raidRisk) _applyHollowedRaid();
      // Clear event effects from economy.mult
      if (gameState._jgEventMult) {
        for (const k in gameState._jgEventMult) {
          if (economy.mult[k] !== undefined) economy.mult[k] = 1;
        }
      }
      if (ev) showMsg(ev.onEnd);
      gameState._jgEvent         = null;
      gameState._jgEventDaysLeft = 0;
      gameState._jgEventMult     = {};
    }
    return; // only one event at a time
  }

  // Chance of new event — ~25% per day, reduced to ~15% if in early weeks
  const week = getJGWeekNumber(gameState.day) || 1;
  const chance = week < 3 ? 0.12 : 0.22;
  if (Math.random() > chance) return;

  // Pick a random event (weighted — bloom and trade wind more common)
  const pool = [
    ...Array(3).fill('jungle_bloom'),
    ...Array(3).fill('eastern_trade_wind'),
    ...Array(2).fill('silk_shortage'),
    ...Array(2).fill('altaverde_audit'),
    ...Array(1).fill('hollowed_raid'),
    ...Array(1).fill('ruins_salvage'),
  ];
  const evId = pool[Math.floor(Math.random() * pool.length)];
  const ev   = JG_MARKET_EVENTS.find(e => e.id === evId);
  if (!ev) return;

  // Don't repeat same event back-to-back
  if (gameState._jgLastEvent === evId) return;

  gameState._jgEvent         = evId;
  gameState._jgEventDaysLeft = ev.dur;
  gameState._jgLastEvent     = evId;
  gameState._jgEventMult     = { ...ev.effect };

  // Apply effect multipliers to economy.mult
  for (const k in ev.effect) {
    if (economy.mult[k] !== undefined) {
      economy.mult[k] = ev.effect[k];
    }
  }

  // Special event effects
  if (ev.salvageIncome) {
    const [min, max] = ev.salvageAmount;
    const income = min + Math.floor(Math.random() * (max - min + 1));
    player.gold += income;
    spawnParticles(player.x, player.y, '#f0d060', 6, '+$' + income);
    showMsg(ev.onTrigger + '$' + income.toLocaleString() + '.');
  } else {
    showMsg(ev.onTrigger);
  }

  if (ev.complianceEffect && typeof gameState._complianceLevel !== 'undefined') {
    gameState._complianceLevel = Math.max(0, (gameState._complianceLevel || 0) + ev.complianceEffect);
    updateComplianceHUD();
  }

  updateJGEventHUD();
}