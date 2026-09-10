function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  /* First frame guard */
  if (!lastTime) { lastTime = timestamp; }

  const dt = Math.min(timestamp - lastTime, 100); /* cap at 100ms to prevent spiral-of-death */
  lastTime  = timestamp;
  accumulator += dt;

  while (accumulator >= NES.FRAME_MS) {
    update();
    accumulator -= NES.FRAME_MS;
  }

  inputFlush();   /* once per rAF — preserves .just flags across catch-up steps */
  render();
}