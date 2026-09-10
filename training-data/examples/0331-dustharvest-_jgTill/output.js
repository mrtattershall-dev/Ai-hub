function _jgTill(tx, ty, key, wx, wy) {
  const tile = getJGT(tx, ty);
  if (tile !== JG.MUD && tile !== JG.DIRT) {
    if (tile === JG.FARM_PLOT) { showMsg('Already tilled.'); return true; }
    return false;
  }
  if (actionTimer.active && actionTimer._nodeKey === key + '_jgtill') return true;
  if (actionTimer.active) cancelAction('');
  actionTimer._nodeKey = key + '_jgtill';

  const hW = getEffectiveHoeW(), hH = getEffectiveHoeH();
  startAction('⛏ Tilling…', getTillDuration(), () => {
    dSound('tool');
    let count = 0;
    for (let dy = 0; dy < hH; dy++) {
      for (let dx = 0; dx < hW; dx++) {
        const ttx = tx + dx, tty = ty + dy;
        if (!isJGFarmTile(ttx, tty)) continue;
        const t = getJGT(ttx, tty);
        if (t !== JG.MUD && t !== JG.DIRT) continue;
        const k = jgPlotKey(ttx, tty);
        if (!jgPlots[k]) jgPlots[k] = _makeJGPlot();
        if (jgPlots[k].tilled && !jgPlots[k].crop) continue;
        jgPlots[k].tilled = true;
        setJGT(ttx, tty, JG.FARM_PLOT);
        count++;
      }
    }
    if (count > 0) {
      stats.tillsDone += count;
      spawnParticles(wx, wy, '#5a4020', Math.min(count * 2, 8), '✦');
      showMsg(`⛏ Tilled ${count} jungle plot${count > 1 ? 's' : ''}! Select a seed and plant.`);
    }
    player.stamina = Math.max(0, player.stamina - 3 * Math.max(1, count));
    player.actionCooldown = 0.1;
    actionTimer._nodeKey = null;
  });
  return true;
}