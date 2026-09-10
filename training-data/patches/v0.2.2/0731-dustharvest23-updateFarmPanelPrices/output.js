function updateFarmPanelPrices() {
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