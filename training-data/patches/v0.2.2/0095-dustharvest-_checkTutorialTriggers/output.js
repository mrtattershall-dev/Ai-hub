function _checkTutorialTriggers() {
  if (!gameState || gameState.day > 1) return;
  if (!player || !stats) return;
  const ptx = Math.floor(player.x / T);
  const pty = Math.floor(player.y / T);
  const hour = gameState.timeOfDay || 0;

  // 1. Debt — after 5 real seconds
  if (!_tipShown.has('debt') && _tipElapsed >= 5)
    _queueTip('debt', '💸 You owe $100 in land debt — it grows weekly. Open the Market [M] and pay it down before it compounds.');

  // 2. Seeds — after 12 seconds, if nothing planted yet
  if (!_tipShown.has('seeds') && _tipElapsed >= 12 && stats.plantingsDone === 0)
    _queueTip('seeds', '🌱 Step one: buy seeds at the Market [M]. Carrots are cheapest. Till soil with the Hoe, then plant.');

  // 3. Tilled first plot
  if (!_tipShown.has('tilled') && stats.tillsDone > 0)
    _queueTip('tilled', '💧 Good. Now water those plots with the Water Can, then plant seeds from your inventory or the farm panel.');

  // 4. First plant
  if (!_tipShown.has('planted') && stats.plantingsDone > 0)
    _queueTip('planted', '🌱 Planted! Water every morning before 8am. Miss a day — crop wilts. Miss two — it dies and the plot resets. Harvest when ready, sell at [M].');

  // 5. Near market building
  if (!_tipShown.has('market_near') && Math.abs(ptx - 40) < 5 && Math.abs(pty - 26) < 5)
    _queueTip('market_near', '🏪 This is the Market. Buy seeds, sell crops, upgrade tools, pay debt. Press [M] anywhere to open it.');

  // 6. Evening — market closes
  if (!_tipShown.has('night_warn') && hour >= 19 && hour < 20.5)
    _queueTip('night_warn', '🌙 Night is coming. The Market closes after dark — sell what you have now.');

  // 7. Hunger dropping
  if (!_tipShown.has('hunger') && player.hunger < 65)
    _queueTip('hunger', '🍽 Getting hungry. Open inventory [M → Inventory or Tab] and click a crop or fish to eat it raw.');

  // 8. Low stamina
  if (!_tipShown.has('stamina') && player.stamina < 25)
    _queueTip('stamina', '😤 Low stamina — eat something to recover. Sprinting [Shift] drains it fast. Rest idle to regen.');

  // 9. First harvest
  if (!_tipShown.has('harvested') && stats.totalCropsHarvested > 0)
    _queueTip('harvested', '🎉 First harvest! Open the Market [M] and go to the Sell tab to turn those crops into gold.');

  // 10. Near mine — warn off on Day 1
  if (!_tipShown.has('mine_near') && (getT(ptx, pty) === TL.MINE || getT(ptx, pty + 1) === TL.MINE))
    _queueTip('mine_near', '⛏ The mine is brutal on Day 1. Get your farm running first — come back when you have better gear.');
}