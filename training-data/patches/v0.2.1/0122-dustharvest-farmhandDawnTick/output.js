function farmhandDawnTick() {
  if (_fhWeeksLeft <= 0) return;
  _fhWeeksLeft--;
  // Auto water + harvest
  const plotList = Object.entries(plots);
  let watered = 0, harvested = 0;
  for (const [k, p] of plotList) {
    if (p.tilled && p.crop && !p.wateredToday && !p.harvestReady && !p.wilted) {
      p.watered = true; p.wateredToday = true;
      const [tx,ty] = k.split(',').map(Number); setT(tx,ty,TL.FARM_WATERED); watered++;
    }
  }
  for (const [k, p] of plotList) {
    if (p.harvestReady) {
      const added = addItem(p.crop, 1 + getEffectiveHarvestBonus());
      if (added === 0) break;
      p.crop = null; p.tilled = true; p.watered = false; p.growthProgress = 0;
      p.wateredToday = false; p.wilted = false; p.harvestReady = false;
      const [tx,ty] = k.split(',').map(Number); setT(tx,ty,TL.FARM_TILLED); harvested++;
    }
  }
  buildHotbar();
  const badge = document.getElementById('fhWeekBadge');
  if (badge) { badge.textContent = `${_fhWeeksLeft}d`; badge.style.display = _fhWeeksLeft > 0 ? 'inline-block' : 'none'; }
  const parts = [];
  if (watered)   parts.push(`watered ${watered}`);
  if (harvested) parts.push(`harvested ${harvested}`);
  if (parts.length) showMsg(`🧑‍🌾 Jed's on it — ${parts.join(', ')} today. (${_fhWeeksLeft}d left)`);
  if (_fhWeeksLeft === 0) showMsg(`🧑‍🌾 Jed's weekly hire ended. Come see me to rehire.`);
}