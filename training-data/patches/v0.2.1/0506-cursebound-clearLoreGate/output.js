function clearLoreGate() {
  if (!G.loreCollected || G.loreCollected.size < TOTAL_LORE) return;
  const zone = ZONES[LORE_GATE_ZONE];
  if (!zone || !zone.mapData) return;
  const md = zone.mapData;
  let changed = false;
  for (const r of LORE_GATE_ROWS_DEF) {
    for (let c = LORE_GATE_C0; c <= LORE_GATE_C1; c++) {
      if (md.data[r * md.cols + c] !== 0) {
        md.data[r * md.cols + c] = 0;
        changed = true;
      }
    }
  }
  if (changed) {
    zone.staticCanvas = null;
    if (G.player) { G.player.notifyText = 'THE WAY IS OPEN'; G.player.notifyTimer = 180; }
    Shake.trigger(6);
    if (DEBUG) console.log('[loreGate] Gate cleared.');
  }
}