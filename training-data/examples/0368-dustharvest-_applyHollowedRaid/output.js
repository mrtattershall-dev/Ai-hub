function _applyHollowedRaid() {
  if (!gameState.inJungle) return; // raid only matters if player is in jungle
  let damaged = 0;
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled || !p.crop) continue;
    if (Math.random() < 0.35) { // 35% chance per plot
      p.wilted = true;
      damaged++;
    }
  }
  if (damaged > 0) {
    showMsg(`💀 Hollowed Raid — ${damaged} crop${damaged > 1 ? 's' : ''} wilted overnight. They weren't here for you. But the damage is done.`);
  }
}