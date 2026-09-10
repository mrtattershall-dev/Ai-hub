function autoEquipTool() {
  if (_manualToolTimer > 0) return; // respect manual selection
  if (gameState.inBadlands || gameState.inMine) return; // no farm tools in badlands/mine
  const tx = Math.floor(player.x/T), ty = Math.floor(player.y/T);
  const nearby = [[tx,ty],[tx,ty+1],[tx,ty-1],[tx+1,ty],[tx-1,ty]];
  let best = null;
  for (const [cx,cy] of nearby) {
    const t = getT(cx, cy);
    const key = plotKey(cx,cy);
    const p = plots[key];
    if (p) {
      if (p.harvestReady) { best = 'harvest'; break; }
      if (p.tilled && !p.crop && player.tool !== 'plant') { best = best||'plant'; }
      if (!p.tilled) { best = best||'till'; }
      if (p.tilled && p.crop && !p.wateredToday && !p.harvestReady) { best = best||'water'; }
    }
    if (t===TL.DIRT && isFarmTile(cx,cy) && !best) best = 'till';
  }
  if (best && best !== player.tool && best !== _lastAutoTool) {
    _lastAutoTool = best;
    selectTool(best, true); // true = auto, don't set manual timer
    showMsg(`🔧 Auto: ${best}`, 1000);
  } else if (!best) {
    _lastAutoTool = null;
  }
}