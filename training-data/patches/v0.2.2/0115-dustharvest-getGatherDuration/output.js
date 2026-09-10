function getGatherDuration(type) {
  if (player._debugInstant) return 0.05;
  if (type === 'stone') return Math.max(0.25, (player._gatherCd || 1.0) * 2.2);
  if (type === 'wood')  return Math.max(0.25, (player._woodCd  || 1.0) * 2.2);
  if (type === 'herb')  return 0.9;  // herbs are quick regardless
  return 1.0;
}