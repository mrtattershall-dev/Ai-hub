function broadcastChangedPlots(before) {
  if (!mp.isActive()) return;
  const patches = {};
  // Changed / new plots
  for (const [k, p] of Object.entries(plots)) {
    const b = before[k];
    if (!b || JSON.stringify(p) !== JSON.stringify(b)) {
      patches[k] = { ...p };
    }
  }
  // Deleted plots
  for (const k of Object.keys(before)) {
    if (!plots[k]) patches[k] = null;
  }
  if (Object.keys(patches).length > 0) {
    mp.broadcast({ type: 'plot_patch', patches });
  }
}