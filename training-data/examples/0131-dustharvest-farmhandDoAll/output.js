function farmhandDoAll() {
  // Bundle: water + harvest + revive at 15% discount
  const plotList = Object.entries(plots);
  const toWater  = plotList.filter(([,p]) => p.tilled && p.crop && !p.wateredToday && !p.harvestReady);
  const toHarv   = plotList.filter(([,p]) => p.harvestReady);
  const toRevive = plotList.filter(([,p]) => p.wilted);
  const dm = getDifficultyConfig().debtMult || 1;
  const rawCost = (Math.max(5, toWater.length*4*dm)) + (Math.max(5, toHarv.length*6*dm)) + (Math.max(8, toRevive.length*8*dm));
  const cost = Math.max(10, Math.round(rawCost * 0.85));
  if (!(toWater.length||toHarv.length||toRevive.length)) { showMsg('🧑‍🌾 Nothing to bundle.'); return; }
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} for the bundle.`); return; }
  player.gold -= cost;
  let w=0, h=0, r=0;
  for (const [k,p] of toWater) { p.watered=true; p.wateredToday=true; p.wilted=false; const [tx,ty]=k.split(',').map(Number); setT(tx,ty,TL.FARM_WATERED); w++; }
  let bagFull = false;
  for (const [k,p] of toHarv) {
    const added = addItem(p.crop, 1+getEffectiveHarvestBonus());
    if (added===0) { bagFull=true; break; }
    p.crop=null; p.tilled=true; p.watered=false; p.growthProgress=0; p.wateredToday=false; p.wilted=false; p.harvestReady=false;
    const [tx,ty]=k.split(',').map(Number); setT(tx,ty,TL.FARM_TILLED); h++;
  }
  for (const [k,p] of toRevive) { p.wilted=false; p.watered=true; p.wateredToday=true; p.growthProgress=Math.max(0,p.growthProgress-.1); const [tx,ty]=k.split(',').map(Number); setT(tx,ty,TL.FARM_WATERED); r++; }
  buildHotbar();
  const parts = [w&&`watered ${w}`,h&&`harvested ${h}${bagFull?' (bag full)':''}`,r&&`revived ${r}`].filter(Boolean);
  showMsg(`🧑‍🌾 Done — ${parts.join(', ')}. ($${cost} paid, bundle deal!)`);
  refreshFarmhandUI();
}