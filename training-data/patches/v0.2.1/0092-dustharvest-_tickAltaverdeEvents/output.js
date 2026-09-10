function _tickAltaverdeEvents() {
  const week = Math.floor((gameState.day-1)/DEBT_WEEK_LENGTH) + 1;
  if (week < 8) return; // quiet until week 8

  const day = gameState.day;
  const fired = gameState._altaverdeFired || (gameState._altaverdeFired = {});

  // Week 8: Railroad agent appears in town with a buy-out offer
  if (week === 8 && !fired.buyout) {
    fired.buyout = true;
    setTimeout(() => {
      showMsg('📬 A letter arrived at the market from Frontier Credit Associates. "Regarding your land note — we have a standing offer for deed transfer at assessed value. Come speak with our agent in town." You don\'t know who to trust.');
    }, 3000);
  }

  // Week 10: Price suppression on your 2 most profitable crops
  if (week >= 10 && !fired.suppression && week <= 14) {
    fired.suppression = true;
    const sold = Object.entries(stats.cropsSold||{}).sort((a,b)=>b[1]-a[1]).slice(0,2);
    if (sold.length > 0) {
      gameState._altaverdePrices = gameState._altaverdePrices || {};
      sold.forEach(([cropId]) => {
        if (economy.prices[cropId]) {
          const suppressed = Math.round(economy.prices[cropId] * 0.65);
          gameState._altaverdePrices[cropId] = suppressed; // store so load can restore
          economy.prices[cropId] = suppressed;
        }
      });
      const names = sold.map(([id]) => ITEMS[id]?.name || id).join(' and ');
      showMsg(`📉 Market alert: ${names} prices have dropped sharply. Someone is flooding the market. Maya says she's never seen it move this fast.`);
    }
  }

  // Week 12: Vera mentions Altaverde has noticed the evidence gathering
  if (week === 12 && !fired.veraWarning && hcTalkSeen && hcTalkSeen.has('vera_met')) {
    fired.veraWarning = true;
    setTimeout(() => {
      showMsg('📜 Vera sent word through the camp: "They know someone has been asking questions. Be careful what you carry. Some of what you found would disappear fast if the wrong person saw your bag."');
    }, 5000);
  }

  // Week 14: Debt instrument transferred — new creditor letter
  if (week === 14 && !fired.creditorTransfer) {
    fired.creditorTransfer = true;
    setTimeout(() => {
      showMsg('📬 A new letter. "Your land note has been transferred to Altaverde Agricultural Holdings. Payments continue on the same schedule." Same debt. New name on the paper. Simons warned you about this.');
    }, 4000);
  }

  // Week 16: Prices normalize (Altaverde thinks you\'re beaten)
  if (week === 16 && !fired.priceNorm && fired.suppression) {
    fired.priceNorm = true;
    // Actually restore suppressed prices to BASE_PRICES values
    if (gameState._altaverdePrices) {
      Object.keys(gameState._altaverdePrices).forEach(id => {
        if (BASE_PRICES[id] !== undefined) economy.prices[id] = BASE_PRICES[id];
      });
      gameState._altaverdePrices = {};
    }
    showMsg('📈 Market prices are recovering. Whatever was suppressing them seems to have backed off. Maya: "Whoever was selling cheap stopped. Good for us."');
  }

  // Week 20: If Vera\'s case is filed, a town NPC references it
  if (week === 20 && !fired.veraFiled && hcTalkSeen && hcTalkSeen.has('vera_case_acknowledged')) {
    fired.veraFiled = true;
    setTimeout(() => {
      showMsg('📜 Maya mentioned a city clerk came through asking about land records for frontier sector fourteen. She didn\'t know why. You do.');
    }, 6000);
  }

  // Week 22: Final pressure — agent reappears with an ultimatum
  if (week === 22 && !fired.ultimatum) {
    fired.ultimatum = true;
    setTimeout(() => {
      showMsg('📬 Another letter. "Our offer expires at the end of the season. After that, we pursue the mineral rights claim through the courts. You have two weeks." Pay the debt. Own the land. That\'s always been the answer.');
    }, 5000);
  }
}