function fitCanvas() {
  const sx = Math.floor(window.innerWidth  / NES.W);
  const sy = Math.floor(window.innerHeight / NES.H);
  SCALE = Math.max(1, Math.min(sx, sy));

  const w = NES.W * SCALE;
  const h = NES.H * SCALE;

  screenEl.style.width  = w + 'px';
  screenEl.style.height = h + 'px';
  screenCanvas.style.width  = w + 'px';
  screenCanvas.style.height = h + 'px';

  /* Sync debug overlay size */
  document.getElementById('debug-overlay').style.fontSize =
    Math.max(9, SCALE * 6) + 'px';
}