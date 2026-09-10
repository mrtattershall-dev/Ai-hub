function applyJGCompost(tx, ty) {
  const key = jgPlotKey(tx, ty);
  if (!jgPlots[key]) { showMsg('⚠️ Till this soil first.'); return; }
  const p = jgPlots[key];
  if (p.soilTier === 'restored') { showMsg('Soil is already fully restored.'); return; }
  if (countItem('jgCompost') <= 0) { showMsg('⚠️ No jungle compost — craft some first.'); return; }
  removeItem('jgCompost', 1);
  p.compostUses = (p.compostUses || 0) + 1;
  _advanceJGSoilTier(key, p);
  spawnParticles(tx * JG_T + JG_T / 2, ty * JG_T + JG_T / 2, '#806040', 5, '🌱');
  showMsg('🌱 Compost applied — soil healing accelerated.');
}