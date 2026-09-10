function farmhandDoHarvest() {
  const targets = Object.entries(plots).filter(([,p]) => p.harvestReady);
  const cost = Math.max(5, Math.round(targets.length * 6 * (getDifficultyConfig().debtMult||1)));
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} to hire.`); return; }
  let bagFull = false;
  player.gold -= cost;
  let done = 0;
  for (const [k, p] of targets) {
    const added = addItem(p.crop, 1 + getEffectiveHarvestBonus());
    if (added === 0) { bagFull = true; break; }
    p.crop = null; p.tilled = true; p.watered = false; p.growthProgress = 0;
    p.wateredToday = false; p.wilted = false; p.harvestReady = false;
    const [tx,ty] = k.split(',').map(Number);
    setT(tx, ty, TL.FARM_TILLED);
    done++;
  }
  buildHotbar();
  const bagMsg = bagFull ? ' (stopped — bag full!)' : '';
  showMsg(`🧑‍🌾 Jed harvested ${done} plot${done>1?'s':''}${bagMsg}. ($${cost} paid)`);
  refreshFarmhandUI();
}