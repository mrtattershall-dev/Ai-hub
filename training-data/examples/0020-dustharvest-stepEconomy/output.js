function stepEconomy() {
  // Archive prices
  for (const k in economy.prices) {
    if (economy.hist[k]) { economy.hist[k].push(economy.prices[k]); if (economy.hist[k].length>10) economy.hist[k].shift(); }
  }
  // Tick event
  if (economy.event) {
    economy.evDaysLeft--;
    if (economy.evDaysLeft <= 0) {
      economy.event = null;
      economy.mult = resetMult();
      showMsg('📊 Market event ended — prices returning to normal.');
    }
  }
  // Chance of new event
  if (!economy.event && Math.random() < .28) {
    const ev = MARKET_EVENTS[Math.floor(Math.random()*MARKET_EVENTS.length)];
    economy.event = ev; economy.evDaysLeft = ev.dur;
    economy.mult = resetMult();
    for (const k in ev.effect) economy.mult[k] = ev.effect[k];
    if (ev.onTrigger) {
      showMsg(ev.onTrigger);
    } else {
      showMsg(`📢 MARKET EVENT: ${ev.name} — ${ev.desc}`);
    }
  }
  // Recalculate prices (with seasonal bonus and difficulty volatility scaling)
  const seasonBonus = getCurrentSeason() ? getCurrentSeason().priceBonus : {};
  const _volMult = getDifficultyConfig().volMult || 1.0; // peaceful=0.5, hard=1.6
  for (const k in economy.prices) {
    const base = BASE_PRICES[k]||10;
    const vol  = (VOLATILITY[k]||.2) * _volMult;
    const noise = 1 + (Math.random()*2-1)*vol;
    const seasonal = 1 + (seasonBonus[k]||0);
    economy.prices[k] = Math.max(1, Math.round(base * noise * (economy.mult[k]||1) * seasonal));
  }
  // Seed prices also fluctuate slightly, scaled by difficulty
  const _seedMult = getDifficultyConfig().seedPriceMult || 1.0;
  for (const k in economy.seedPrices) {
    const base = BASE_SEED_PRICES[k]||2;
    economy.seedPrices[k] = Math.max(1, Math.round(base * _seedMult * (1+(Math.random()*.3-.1))));
  }
  updateFarmPanelPrices();
}