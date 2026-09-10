function writeJournalEntry() {
  // Called at dawn (showDaySummary), writes the entry for the day just passed
  const curr = _takeJournalSnapshot();
  if (!_journalDaySnapshot) {
    // First dawn — just store the snapshot, no entry for "day 0"
    _journalDaySnapshot = curr;
    return;
  }
  const prev = _journalDaySnapshot;
  const day = prev.day;
  const diff = _diffSnapshot(prev, curr);
  const dayType = _classifyDay(diff, prev);
  const entryText = _buildJournalEntry(dayType, diff, prev, day);

  const entry = {
    day,
    season: prev.season,
    weekNumber: prev.weekNumber,
    gold: prev.gold,
    goldDelta: diff.goldDelta,
    totalDebt: prev.totalDebt,
    dayType,
    entry: entryText,
    snapshot: {
      kills:          diff.kills,
      cropsHarvested: diff.cropsHarvested,
      oreMined:       diff.oreMined,
      fishCaught:     diff.fishCaught,
      planted:        diff.planted,
      crafted:        diff.crafted,
      debtPaid:       diff.debtPaid,
      woodChopped:    diff.woodChopped,
      stoneGathered:  diff.stoneGathered,
    },
  };

  // Keep last 100 entries max (prevents save bloat)
  if (!stats.journalLog) stats.journalLog = [];
  stats.journalLog.push(entry);
  if (stats.journalLog.length > 100) stats.journalLog.shift();

  // Advance snapshot to current
  _journalDaySnapshot = curr;
}