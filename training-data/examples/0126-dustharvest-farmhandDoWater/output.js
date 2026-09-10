function farmhandDoWater() {
  const plotList = Object.entries(plots);
  const targets = plotList.filter(([,p]) => p.tilled && p.crop && !p.wateredToday && !p.harvestReady);
  const cost = Math.max(5, Math.round(targets.length * 4 * (getDifficultyConfig().debtMult||1)));
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} to hire.`); return; }
  player.gold -= cost;
  let done = 0;
  for (const [k, p] of targets) {
    p.watered = true; p.wateredToday = true; p.wilted = false;
    const [tx,ty] = k.split(',').map(Number);
    setT(tx, ty, TL.FARM_WATERED);
    done++;
  }
  showMsg(`🧑‍🌾 Jed watered ${done} plot${done>1?'s':''}. ($${cost} paid)`);
  refreshFarmhandUI();
}