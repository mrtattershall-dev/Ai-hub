function update() {
  if (!ready) return;

  /* Channel-steal countdown */
  if (pulse1MusicMuted) {
    pulse1MuteTimer--;
    if (pulse1MuteTimer <= 0) {
      pulse1MusicMuted = false;
      pulse1MuteTimer  = 0;
    }
  }

  /* Jump SFX — INPUT.A.just is still valid here (flush happens after all updates) */
  if (INPUT.A.just && G.player && G.player.onGround) {
    SFX.jump();
  }

  /* Hand approach scratch — fires once when warnTimer flips to 1,
     then grows louder proportional to distance (called each frame
     while active but throttled to every 30 frames to avoid spam). */
  const hand = G.theHand;
  if (hand && hand.active && !hand.stunTimer && G.player) {
    if (hand.warnTimer > 0 && G.frame % 30 === 0) {
      /* Pan based on Hand position relative to viewport centre */
      const hcx = hand.x + hand.w * 0.5;
      const sceneW = NES.W;
      const pan = ((hcx - Camera.x) - sceneW * 0.5) / (sceneW * 0.5);
      SFX.handApproach(pan);
    }
  }
}