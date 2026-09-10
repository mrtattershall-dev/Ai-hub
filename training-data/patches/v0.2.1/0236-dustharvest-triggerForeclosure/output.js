function triggerForeclosure() {
  if (_foreclosureFired) return;
  _foreclosureFired = true;

  // Close all open panels
  if (marketOpen)   closeMarket();
  if (invOpen)      { invOpen = false; document.getElementById('invOverlay').style.display = 'none'; }
  if (pauseOpen)    closePause();
  if (settingsOpen) closeSettings();
  if (daySummaryOpen) closeDaySummary();
  if (chestOpen)    closeChest();
  if (farmhandOpen) closeFarmhand();
  if (npcTalkOpen)  closeNpcTalk();
  cancelAction('');
  enemies.length = 0;

  const overdueWeeks = weeklyBills.filter(b => !b.paid && b.due + DEBT_WEEK_LENGTH * 2 <= gameState.day).length;
  const totalOwed = getTotalDebt();
  const survived = gameState.day;
  const harvested = stats.totalCropsHarvested;
  const paid = stats.debtRepaid;

  document.getElementById('foreclosureMsg').textContent =
    `The bank sent a rider on Day ${survived}. ${overdueWeeks} bill${overdueWeeks>1?'s':''} left unpaid for two weeks — the deed reverts to Altaverde Holdings. The frontier took the farm.`;

  document.getElementById('foreclosureStats').innerHTML =
    `Day ${survived} &nbsp;·&nbsp; $${paid.toLocaleString()} paid toward debt<br>` +
    `$${totalOwed.toLocaleString()} still owed &nbsp;·&nbsp; ${harvested} crops harvested`;

  document.getElementById('foreclosureScreen').classList.add('show');
  dSound && dSound('gameover');
}