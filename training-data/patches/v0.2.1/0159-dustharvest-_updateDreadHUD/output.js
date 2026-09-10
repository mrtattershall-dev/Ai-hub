function _updateDreadHUD() {
  const bar   = document.getElementById('dreadBar');
  const fill  = document.getElementById('dreadFill');
  const label = document.getElementById('dreadLabel');
  if (!bar || !fill) return;
  const d = gameState._mineDread || 0;
  if (d > 0 && gameState.inMine && gameState.mineFloor >= 1) {
    bar.style.display = 'block';
    fill.style.width = d + '%';
    fill.style.background = d >= 80 ? 'linear-gradient(90deg,#8010a0,#ff20ff)' : 'linear-gradient(90deg,#5030a0,#c030c0)';
    if (label) {
      label.style.display = d >= 50 ? 'block' : 'none';
      label.textContent = d >= 100 ? '😱 DREAD PEAK — losing your mind!' : d >= 75 ? '😰 The dark is alive…' : '😶 Something watches from the dark.';
    }
  } else {
    bar.style.display = 'none';
    if (label) label.style.display = 'none';
  }
}