function _applyJGCompost(ptx, pty) {
  if (!countItem('jungleCompost')) {
    showMsg('⚠ No jungle compost. Get animals producing first.');
    return false;
  }
  const key = `${ptx},${pty}`;
  const plot = jgPlots[key];
  if (!plot) { showMsg('⚠ Till this plot first.'); return false; }
  if (plot.soilTier === 'restored') { showMsg('✓ This plot is already fully restored.'); return false; }
  removeItem('jungleCompost', 1);
  const prev = plot.soilTier;
  if (plot.soilTier === 'stripped') plot.soilTier = 'recovering';
  else if (plot.soilTier === 'recovering') plot.soilTier = 'restored';
  spawnParticles(ptx * JG_T + JG_T/2, pty * JG_T + JG_T/2, '#70c040', 5, '🌱');
  showMsg(`🌱 Compost applied — soil ${prev} → ${plot.soilTier}.`);
  return true;
}