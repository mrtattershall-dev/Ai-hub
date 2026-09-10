function updateMineHUD() {
  const el = document.getElementById('mineHUD');
  if (!el) return;
  if (gameState.inMine) {
    el.style.display = 'block';
    const fl = gameState.mineFloor;
    const vis = getMineVisibility();
    const visStr = vis < 1 ? ` 👁 ${Math.round(vis * 100)}%` : '';
    const hazStr = _mineHazard ? ` ⚠️ ${(_mineHazard.type).toUpperCase()}` : '';
    const flLabel = gameState.mineFloor === 3 ? `Floor 4 — The Unmapped` : `Floor ${fl+1}/3 — ${MINE_FLOOR_CFG[fl].name}`;
    const candleStr = gameState._candleBurnLeft > 0 ? ` 🕯️ ${Math.ceil(gameState._candleBurnLeft)}s` : '';
    el.innerHTML = `⛏ ${flLabel}${visStr}${hazStr}${candleStr}`;
    el.style.color = _mineHazard ? '#e07040' : '#90b0e8';
    if (_mineRumbleFlash > 0) {
      el.style.background = `rgba(200,80,40,${Math.min(0.4, _mineRumbleFlash * 0.3)})`;
    } else {
      el.style.background = '';
    }
  } else if (gameState.inBLMine) {
    el.style.display = 'block';
    const fl = gameState.blMineFloor;
    const cfg = BL_MINE_FLOOR_CFG[fl];
    const vis = cfg.visibility;
    const visStr = vis < 1 ? ` 👁 ${Math.round(vis * 100)}%` : '';
    el.innerHTML = `⛏ ${cfg.name}${visStr}`;
    el.style.color = '#8090b0';
    el.style.background = '';
  } else {
    el.style.display = 'none';
  }
  _updateDreadHUD();
}