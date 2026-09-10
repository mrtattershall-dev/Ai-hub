function drawDebug() {
  if (!DEBUG) return;
  const p = G.player;
  const lines = [
    `STATE: ${G.state}  F:${G.frame}`,
    `INPUT: ${Object.entries(INPUT).filter(([,v])=>v.pressed).map(([k])=>k).join(' ')||'—'}`,
    `CAM: ${G.camera.x|0},${G.camera.y|0}  SCALE:${SCALE}`,
    `ZONE: ${G.currentZoneId||'—'}`,
    p ? `PL: (${p.x|0},${p.y|0}) v:(${p.vx.toFixed(1)},${p.vy.toFixed(1)}) HP:${p.hp}/${p.maxHp} GND:${p.onGround?1:0} KB:${p.kbTimer}` : '',
  ].filter(Boolean);
  dbgEl.textContent = lines.join('\n');
}