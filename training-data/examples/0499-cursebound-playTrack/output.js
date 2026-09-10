function playTrack(trackKey) {
  if (!ready) return;
  const track = TRACKS[trackKey];
  if (!track) return;
  if (currentTrack === track && musicPlaying) return;  /* already playing */

  currentTrack  = track;
  musicStep     = 0;
  musicPlaying  = true;
  musicPaused   = false;
  schedNextTime = ctx.currentTime + 0.05;
  if (DEBUG) console.log(`[audio] track: ${trackKey}`);
}