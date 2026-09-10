function _steal(ms) {
  /* Mute pulse1 music voice for ms milliseconds */
  if (pulse1MusicGain) {
    try { pulse1MusicGain.gain.setValueAtTime(0, ctx.currentTime); } catch(e) {}
  }
  pulse1MusicMuted = true;
  pulse1MuteTimer  = ms;
  /* Auto-restore handled in Audio.update() called from game loop */
}