function startNewGame() {
  // Apply difficulty starting gold
  const diffCfg = getDifficultyConfig();
  player.gold = diffCfg.startGold || 120;
  // Reset inventory seeds
  for (const k in inventory.seeds) inventory.seeds[k] = 0;
  // Reset chest for fresh game
  for (let i = 0; i < getChestSize(); i++) chestSlots[i] = null;
  // Reset stats (preserve journalLog structure correctly)
  for (const key of Object.keys(stats)) {
    if (key === 'journalLog') { stats.journalLog = []; continue; }
    if (typeof stats[key] === 'object' && stats[key] !== null) {
      for (const k of Object.keys(stats[key])) delete stats[key][k];
    } else {
      stats[key] = 0;
    }
  }
  // Reset journal snapshot
  _journalDaySnapshot = null;
  minerTalkSeen = new Set();
  blTalkSeen = new Set();
  hcTalkSeen = new Set();
  // Reset jungle state for fresh game
  if (typeof jungleTalkSeen !== 'undefined') jungleTalkSeen = new Set();
  for (const k in jgPlots) delete jgPlots[k];
  if (typeof jgWeeklyBills !== 'undefined') jgWeeklyBills.length = 0;
  if (typeof jgDebtPaidLog !== 'undefined') jgDebtPaidLog.length = 0;
  gameState._jgDebt = undefined;
  gameState._jgDebtStartDay = undefined;
  gameState._jgDebtFree = false;
  gameState._jgAltaverdeWarned = false;
  gameState._jgSeeds = {};
  gameState._jgSelectedSeed = 'heartleaf';
  gameState.inJungle = false;
  _jgFarmPanelOpen = false;
  _craneSellCount = 0;
  gameState._deepestMineFloor = 0;
  gameState._mineJournal      = [];
  gameState._mineLastHaul     = {};
  gameState._mineCoalSessions = 0;
  gameState._deepMapUsed      = {};
  gameState._mineDread        = 0;
  gameState._candleBurnLeft   = 0;
  initFog();
  hideTitleScreen();
  tickSeason(gameState.day);
  stepEconomy();
  generateContracts(1);
  weeklyBills = [];  // clear so debtMult applies fresh
  generateWeeklyBills(1);
  buildHotbar();
  _introSkipped = false;
  // Show debt clock
  document.getElementById('debtClock').classList.add('show');
  updateDebtClock();
  runIntro();
  // Show controls on first play (after intro)
  setTimeout(showControlsIfNeeded, 22000);
}