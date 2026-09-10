function render() {
  /* Always clear with black to avoid ghost frames */
  screenCtx.fillStyle = PAL.BLACK;
  screenCtx.fillRect(0, 0, NES.W, NES.H);

  /* imageSmoothingEnabled can be reset by fillRect on some browsers;
     re-assert it every frame to be safe */
  screenCtx.imageSmoothingEnabled = false;

  /* Screen shake — translate canvas before drawing game content */
  const { x: shakeX, y: shakeY } = Shake.offset();
  screenCtx.save();
  screenCtx.translate(shakeX, shakeY);

  switch (G.state) {
    case STATE.TITLE:   titleScreen.draw(screenCtx);        break;
    case STATE.INTRO:   introScreen.draw(screenCtx);        break;
    case STATE.PLAYING: playingPlaceholder.draw(screenCtx); break;
    case STATE.LORE_READ:
      playingPlaceholder.draw(screenCtx);   /* game frozen behind the panel */
      break;
    case STATE.PAUSED:
      playingPlaceholder.draw(screenCtx);
      pauseScreen.draw(screenCtx);
      break;
    case STATE.DEAD:    deadScreen.draw(screenCtx);         break;
    case STATE.WIN:     winScreen.draw(screenCtx);          break;
  }

  screenCtx.restore();

  /* Zone transition flash — solid black wipe between rooms */
  if (_transitionFlash > 0) {
    _transitionFlash--;
    screenCtx.fillStyle = PAL.BLACK;
    screenCtx.fillRect(0, 0, NES.W, NES.H);
  }

  /* Lore panel sits outside the shake transform — stays readable during hits */
  if (G.state === STATE.PLAYING || G.state === STATE.PAUSED || G.state === STATE.LORE_READ) {
    lorePanel.draw(screenCtx);
  }

  drawDebug();
}