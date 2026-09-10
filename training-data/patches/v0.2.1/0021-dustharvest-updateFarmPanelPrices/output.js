function updateFarmPanelPrices() {
  // Live plot status summary
  const statusEl = document.getElementById('farmPanelStatus');
  if (statusEl && typeof plots !== 'undefined') {
    const allPlots = Object.values(plots);
    const ready   = allPlots.filter(p => p.harvestReady).length;
    const wilting = allPlots.filter(p => p.wilted).length;
    const growing = allPlots.filter(p => p.tilled && p.crop && !p.harvestReady && !p.wilted).length;
    const parts = [];
    if (ready   > 0) parts.push(`<span style="color:#80d040">🌾 ${ready} ready</span>`);
    if (wilting > 0) parts.push(`<span style="color:#e09030">🥀 ${wilting} wilting!</span>`);
    if (growing > 0) parts.push(`<span style="color:#c8b880">🌱 ${growing} growing</span>`);
    if (parts.length === 0) parts.push(`<span style="color:#4a3a18">No active plots</span>`);

    // Garlic feedback
    const garlicPlots = allPlots.filter(p => p.crop === 'garlic' && !p.wilted).length;
    if (garlicPlots >= 2) parts.push(`<span style="color:#d0c890">🧄 wolves reduced</span>`);

    // Debt pressure — always show balance, urgent styling when close
    if (typeof getTotalDebt === 'function' && typeof getWeekNumber === 'function') {
      const debt = getTotalDebt();
      if (debt > 0) {
        const currentWeek = getWeekNumber(gameState.day);
        const nextBillDay = currentWeek * DEBT_WEEK_LENGTH + 1;
        const daysLeft = nextBillDay - gameState.day;
        const nextAmt = getWeeklyBillAmount(currentWeek + 1);
        const overdue = weeklyBills.filter(b => !b.paid && b.due < gameState.day).length;
        if (overdue > 0) {
          parts.push(`<span style="color:#e04040">🏦 ${overdue} bill${overdue>1?'s':''} overdue!</span>`);
        } else if (daysLeft <= 2 && nextAmt > 0 && currentWeek < DEBT_TOTAL_WEEKS) {
          parts.push(`<span style="color:#e07030">🏦 $${nextAmt} due in ${daysLeft}d</span>`);
        } else if (daysLeft <= 4 && nextAmt > 0 && currentWeek < DEBT_TOTAL_WEEKS) {
          parts.push(`<span style="color:#c09030">🏦 $${nextAmt} in ${daysLeft}d</span>`);
        } else {
          parts.push(`<span style="color:#6a5020">🏦 $${debt.toLocaleString()} owed</span>`);
        }
      } else if (weeklyBills.length >= DEBT_TOTAL_WEEKS) {
        parts.push(`<span style="color:#60d040">🏦 DEBT CLEAR</span>`);
      }
    }

    statusEl.innerHTML = parts.join('&nbsp;·&nbsp;');
  }
  const crops = ['carrot','corn','pumpkin','glowroot','tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry'];
  crops.forEach((c,i) => {
    const el = document.getElementById('mp'+i); if(el) el.textContent = economy.prices[c];
    const sc = document.getElementById('sc'+i); if(sc) sc.textContent = inventory.seeds[SEED_MAP[c]]||0;
    // Season tier indicator — update color of the seed button
    if (typeof getCropSeasonLabel === 'function') {
      const btn = document.getElementById(['seedCarrot','seedCorn','seedPumpkin','seedGlowroot','seedTomato','seedDustwheat','seedSunblossom','seedPepper','seedMelon','seedPotato','seedLavender','seedCactusFruit','seedBlueberry'][i]);
      if (btn) {
        const lbl = getCropSeasonLabel(c);
        // Find or create the season label span inside the button
        let seasonSpan = btn.querySelector('.season-lbl');
        if (!seasonSpan) {
          seasonSpan = document.createElement('span');
          seasonSpan.className = 'season-lbl';
          seasonSpan.style.cssText = 'font-size:8px;margin-left:auto;padding:1px 4px;border-radius:2px;letter-spacing:.03em;flex-shrink:0;';
          btn.appendChild(seasonSpan);
        }
        seasonSpan.textContent = lbl.text;
        seasonSpan.style.color = lbl.color;
        // Dim banned crops
        btn.style.opacity = getCropSeasonTier(c) === 'banned' ? '0.55' : '1';
      }
    }
  });
}