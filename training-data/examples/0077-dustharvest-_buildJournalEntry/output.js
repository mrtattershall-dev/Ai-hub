function _buildJournalEntry(dayType, diff, snap, day) {
  const pool = JOURNAL_ENTRIES[dayType] || JOURNAL_ENTRIES.quiet;
  // Use day number as seed for deterministic but varied selection
  const base = pool[day % pool.length];

  // Append a short factual addendum based on what the numbers show
  const addenda = [];

  if (diff.goldDelta !== 0) {
    if (diff.goldDelta > 0) addenda.push(`Made $${diff.goldDelta.toLocaleString()} on the day.`);
    else addenda.push(`Down $${Math.abs(diff.goldDelta).toLocaleString()} from start of day.`);
  }
  if (diff.cropsHarvested > 0) addenda.push(`Brought in ${diff.cropsHarvested} crop${diff.cropsHarvested !== 1 ? 's' : ''}.`);
  if (diff.oreMined > 0) addenda.push(`${diff.oreMined} ore out of the mine.`);
  if (diff.fishCaught > 0 && dayType !== 'fishingDay' && dayType !== 'fishing') addenda.push(`Caught ${diff.fishCaught} from the water.`);
  if (diff.kills > 0 && dayType !== 'bloodDay' && dayType !== 'badlandsRaid' && dayType !== 'combat') {
    addenda.push(`${diff.kills} kill${diff.kills !== 1 ? 's' : ''} today.`);
  }
  if (diff.debtPaid > 0) addenda.push(`Paid $${diff.debtPaid.toLocaleString()} toward the debt.`);
  if (snap.totalDebt <= 0 && snap.weekNumber > 1) addenda.push(`Outstanding balance: clear.`);
  else if (snap.totalDebt > 0) addenda.push(`Balance owed: $${snap.totalDebt.toLocaleString()}.`);

  // Add addenda only when they don't repeat the main tone
  const relevantAddenda = addenda.slice(0, 2); // cap to avoid walls of text
  return relevantAddenda.length > 0 ? `${base}\n${relevantAddenda.join(' ')}` : base;
}