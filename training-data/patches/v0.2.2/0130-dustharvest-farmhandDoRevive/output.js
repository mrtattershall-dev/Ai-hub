function farmhandDoRevive() {
  const targets = Object.entries(plots).filter(([,p]) => p.wilted);
  const cost = Math.max(8, Math.round(targets.length * 8 * (getDifficultyConfig().debtMult||1)));
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} to hire.`); return; }
  player.gold -= cost;
  let done = 0;
  for (const [k, p] of targets) {
    p.wilted = false; p.watered = true; p.wateredToday = true; p.growthProgress = Math.max(0, p.growthProgress - 0.1);
    const [tx,ty] = k.split(',').map(Number);
    setT(tx, ty, TL.FARM_WATERED);
    done++;
  }
  showMsg(`🧑‍🌾 Jed revived ${done} wilted crop${done>1?'s':''}. ($${cost} paid)`);
  refreshFarmhandUI();
}