function onStateEnter(s) {
  switch (s) {
    case STATE.TITLE:
      titleScreen.reset();
      break;
    case STATE.PLAYING:
      if (!G.currentZoneId) enterZone(ZONE_ID.ENTRY);
      if (!G.player) initPlayer(G.currentZoneId);
      break;
    case STATE.PAUSED:
      pauseScreen.cursor = 0;  /* always start on RESUME, not wherever it was left */
      break;
    case STATE.DEAD:
      deadScreen.timer = 0;
      break;
    case STATE.WIN:
      winScreen.timer    = 0;
      winScreen.showText = false;
      break;
  }
}