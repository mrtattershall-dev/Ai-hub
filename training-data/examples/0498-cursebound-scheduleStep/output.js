function scheduleStep(stepIdx, time) {
  if (!currentTrack) return;
  const step = currentTrack.steps[stepIdx % currentTrack.steps.length];
  const stepDur = 60 / currentTrack.bpm / 2;  /* eighth-note grid */

  /* pulse1 — channel steal: skip if SFX has muted it */
  if (step.p1 && !pulse1MusicMuted) {
    const g = playNote({
      wave:  waveP125,
      freq:  pitch(step.p1.semi),
      start: time,
      dur:   stepDur,
      vol:   step.p1.vol,
      vibrato: step.p1.vib,
    });
    pulse1MusicGain = g;
  }

  /* pulse2 — 25% duty, structural harmony */
  if (step.p2) {
    playNote({
      wave:  waveP25,
      freq:  pitch(step.p2.semi),
      start: time,
      dur:   stepDur,
      vol:   step.p2.vol,
      vibrato: step.p2.vib,
    });
  }

  /* triangle — bass line, one octave lower */
  if (step.tri) {
    playNote({
      wave:  waveTri,
      freq:  pitch(step.tri.semi),
      start: time,
      dur:   stepDur * 0.95,
      vol:   step.tri.vol,
    });
  }

  /* noise — percussion/atmosphere layer */
  if (step.noise) {
    playNoise({
      start: time,
      dur:   stepDur * 0.5,
      vol:   step.noise.vol,
      short: step.noise.short,
    });
  }
}