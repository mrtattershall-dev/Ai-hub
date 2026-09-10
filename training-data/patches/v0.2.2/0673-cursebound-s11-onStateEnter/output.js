function onStateEnter(s) {
  switch (s) {
    case STATE.TITLE:
      G.collectedWeapons.clear();
      G.currentZoneId    = null;
      G.player           = null;
      G.objectiveFlash   = 0;
      titleScreen.reset();
      if (G.theHand) G.theHand.reset();   /* clear _diedThisSession and all Hand state */
      break;
    case STATE.INTRO:
      /* introScreen.reset() called before setState — nothing to do here */
      break;
    case STATE.PLAYING:
      if (!G.currentZoneId) enterZone(ZONE_ID.ENTRY);
      if (!G.player) initPlayer(G.currentZoneId);
      if (G.theHand) G.theHand.onZoneEnter(G.currentZoneId);
      /* Objective flash — only on fresh game start from intro, not on respawn */
      if (G.prevState === STATE.INTRO) G.objectiveFlash = 300;  /* 5 seconds */
      break;
    case STATE.PAUSED:
      pauseScreen.reset();   /* clear guide state, reset cursor */
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