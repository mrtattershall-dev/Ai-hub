function onStateEnter(s) {
  switch (s) {
    case STATE.TITLE:
      G.collectedWeapons.clear();
      G.loreCollected.clear();
      G.currentZoneId    = null;
      G.player           = null;
      G.objectiveFlash   = 0;
      titleScreen.reset();
      if (G.theHand) G.theHand.reset();
      break;
    case STATE.INTRO:
      break;
    case STATE.PLAYING:
      if (!G.currentZoneId) enterZone(ZONE_ID.ENTRY);
      if (!G.player) initPlayer(G.currentZoneId);
      if (G.theHand) G.theHand.onZoneEnter(G.currentZoneId);
      if (G.prevState === STATE.INTRO) G.objectiveFlash = 300;
      break;
    case STATE.LORE_READ:
      /* Everything is frozen — only the lore panel draws and waits for dismiss */
      break;
    case STATE.PAUSED:
      pauseScreen.reset();
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