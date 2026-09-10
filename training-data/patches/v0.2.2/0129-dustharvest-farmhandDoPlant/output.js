function farmhandDoPlant() {
  const sel = player.selectedSeed;
  if (!sel) { showMsg('⚠️ Pick a crop in Farm menu [F] first.'); return; }
  const sk = SEED_MAP[sel];
  let seedsLeft = inventory.seeds[sk] || 0;
  if (seedsLeft <= 0) { showMsg(`⚠️ No ${CROPS[sel]?.name||sel} seeds in bag.`); return; }
  const targets = Object.entries(plots).filter(([,p]) => p.tilled && !p.crop);
  if (targets.length === 0) { showMsg('⚠️ No tilled empty plots to plant in.'); return; }
  const plantable = Math.min(targets.length, seedsLeft);
  const dm = getDifficultyConfig().debtMult || 1;
  const cost = Math.max(5, Math.round(plantable * 3 * dm));
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} to hire Jed to plant.`); return; }
  player.gold -= cost;
  let done = 0;
  for (const [k, p] of targets) {
    if (done >= seedsLeft) break;
    p.crop = sel; p.growthProgress = 0; p.watered = false; p.wateredToday = false; p.wilted = false; p.harvestReady = false;
    const [tx,ty] = k.split(',').map(Number);
    setT(tx, ty, TL.FARM_DIRT);
    done++;
  }
  inventory.seeds[sk] = Math.max(0, seedsLeft - done);
  buildHotbar();
  showMsg(`🧑‍🌾 Jed planted ${done}× ${CROPS[sel]?.name||sel}. ($${cost} paid)`);
  refreshFarmhandUI();
}