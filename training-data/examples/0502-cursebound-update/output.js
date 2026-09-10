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

  /* Hand approach scratch — superseded by distance-scaled system in v1.2 patch.
     Audio now fires from installHandProximityAudio() at interval proportional
     to hand-player distance (6–18 frames). Trigger here removed to prevent
     double-firing. warnTimer still set by hand.update() for the HUD "!" indicator. */
}