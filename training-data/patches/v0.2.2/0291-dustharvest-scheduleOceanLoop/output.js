function scheduleOceanLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'ocean') return;
  bgmEnsureSetup();
  const V=0.44, BPM=48, B=60/BPM, BAR=B*4, BARS=8, t=startTime;

  // Chord roots: D-A-Bm-G — two bars each
  // D2=73.4, A2=110, B2=123.5, G2=98
  const roots = [
    N.D2, N.D2,
    N.A2, N.A2,
    N.B2, N.B2,
    N.G2, N.G2,
  ];

  for (let bar = 0; bar < BARS; bar++) {
    const bT   = t + bar * BAR;
    const root = roots[bar];

    // Bass swell — long, slow attack, like a wave
    wBass(root, bT, BAR * 0.85, V * 0.60);

    // Off-beat bass fill — on beat 3, alternate bars only — keeps it from droning
    if (bar % 2 === 1) wBass(root * 1.5, bT + B * 2.5, B * 0.7, V * 0.22);

    // Plucked string — one chord tone on beat 2, very sparse
    guitar(root * 4, bT + B * 1.0 - 0.012, 2.8, V * 0.38);

    // Second pluck on beat 4 — odd bars only (leaves space in even)
    if (bar % 2 === 1) guitar(root * 6, bT + B * 3.2, 1.6, V * 0.22);

    // Ghost perc — very faint, just enough to feel the pulse
    // No snare. Only a soft tap on beat 1 of even bars.
    if (bar % 2 === 0) perc(bT, V * 0.06, false);
  }

  // Melody — single plucked line, D major pentatonic (D E F# A B)
  // Very few notes, long durations. Like someone humming while watching the water.
  // D4=294, E4=330, Fs4=370, A4=440, B4=494
  const mel = [
    [0, 0,   N.D4,      3.5],
    [1, 1.5, N.Fs4,     2.0],
    [2, 0,   N.A4,      2.5],
    [2, 3.0, N.Fs4,     1.5],
    [3, 0,   N.E4,      3.8],   // long hold — breathe, watch the horizon
    [4, 1.0, N.D4,      2.0],
    [5, 0,   N.B4,      2.8],
    [5, 3.2, N.A4,      1.5],
    [6, 0,   N.Fs4,     2.2],
    [6, 2.5, N.E4,      1.8],
    [7, 0,   N.D4,      4.0],   // resolve — long, fades to silence
  ];

  for (const [bar, beat, freq, db] of mel)
    guitar(freq, t + bar * BAR + beat * B, db * B * 0.90, V * 0.72);

  // Sparse wind — subtle, oceanic, slightly different character than hobo wind
  try {
    const actx = bgmCtx();
    if (Math.random() > 0.25) {
      const bufSize = actx.sampleRate * 1.8;
      const buf = actx.createBuffer(1, bufSize, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.12;
      const src = actx.createBufferSource();
      src.buffer = buf;
      const hp = actx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 420;  // slightly lower than hobo — open coastal feel
      hp.Q.value = 0.4;
      const g = actx.createGain();
      const windStart = t + Math.random() * BARS * BAR * 0.5;
      g.gain.setValueAtTime(0, windStart);
      g.gain.linearRampToValueAtTime(V * 0.10, windStart + 0.6);
      g.gain.linearRampToValueAtTime(V * 0.06, windStart + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, windStart + 1.8);
      src.connect(hp); hp.connect(g); g.connect(BGM.masterGain);
      if (BGM.reverbInput) { const rs=actx.createGain(); rs.gain.value=0.15; g.connect(rs); rs.connect(BGM.reverbInput); }
      src.start(windStart); src.stop(windStart + 1.8);
    }
  } catch(e2) {}

  const dur = BARS * BAR;
  BGM.seqTimer = setTimeout(() => scheduleOceanLoop(t + dur), (dur - 0.4) * 1000);
}