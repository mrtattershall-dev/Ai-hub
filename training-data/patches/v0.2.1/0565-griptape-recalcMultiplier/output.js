function recalcMultiplier() {
  const synced = editState.clips.filter(c => c.beatSync).length;
  const total  = editState.clips.length;
  editState.multiplier = total > 0 ? (1 + (synced / total) * 1.5) : 1;
  document.getElementById('edit-multiplier').textContent = editState.multiplier.toFixed(1) + '×';
}