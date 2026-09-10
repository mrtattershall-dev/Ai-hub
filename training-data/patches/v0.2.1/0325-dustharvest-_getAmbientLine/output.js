function _getAmbientLine(npcId) {
  const tree = JG_AMBIENT_TALKS[npcId];
  if (!tree) return null;
  const w = getVillageWeeksSettled();
  // Collect unseen lines available for current week
  const available = tree.lines.filter(l => {
    if (l.minWeek > w) return false;
    if (l.flag && jungleTalkSeen.has(l.flag)) return false;
    return true;
  });
  if (!available.length) {
    // Fallback: re-show flagged lines (cycling)
    return tree.lines.filter(l => l.minWeek <= w).slice(-1)[0] || tree.lines[0];
  }
  return available[0]; // always return the first unseen available line
}