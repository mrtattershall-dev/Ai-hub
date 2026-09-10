function update() {
  pollGamepad();
  G.stateTimer++;
  G.frame++;
  Shake.update();
  lorePanel.update();

  switch (G.state) {
    case STATE.TITLE:     titleScreen.update();        break;
    case STATE.INTRO:     introScreen.update();        break;
    case STATE.PLAYING:   playingPlaceholder.update(); break;
    case STATE.LORE_READ: lorePanel.updateDismiss();   break;
    case STATE.PAUSED:    pauseScreen.update();        break;
    case STATE.DEAD:      deadScreen.update();         break;
    case STATE.WIN:       winScreen.update();          break;
  }
  /* inputFlush moved to gameLoop — called once per rAF, not per logic step */
}