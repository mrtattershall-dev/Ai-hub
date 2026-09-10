function render() {
  /* Always clear with black to avoid ghost frames */
  screenCtx.fillStyle = PAL.BLACK;
  screenCtx.fillRect(0, 0, NES.W, NES.H);

  /* imageSmoothingEnabled can be reset by fillRect on some browsers;
     re-assert it every frame to be safe */
  screenCtx.imageSmoothingEnabled = false;

  switch (G.state) {
    case STATE.TITLE:   titleScreen.draw(screenCtx);        break;
    case STATE.PLAYING: playingPlaceholder.draw(screenCtx); break;
    case STATE.PAUSED:
      playingPlaceholder.draw(screenCtx);
      pauseScreen.draw(screenCtx);
      break;
    case STATE.DEAD:    deadScreen.draw(screenCtx);         break;
    case STATE.WIN:     winScreen.draw(screenCtx);          break;
  }

  drawDebug();
}