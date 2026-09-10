function scheduleHoboLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'hobo') return;
  bgmEnsureSetup();
  const V=0.52, BPM=58, B=60/BPM, BAR=B*4, BARS=8, t=startTime;

  // Chord roots: Am - G - F - Am - Am - Em - F - Am
  const roots = [N.Am2, N.G2, 98*0.89/*F2*/, N.Am2, N.Am2, N.Em3*0.5, 98*0.89, N.Am2];

  for (let bar=0; bar<BARS; bar++) {
    const bT = t + bar*BAR;
    const root = roots[bar];

    // Bass on beat 1 — main anchor, shorter duration (not a drone)
    wBass(root, bT, 0.9, V*0.72);
    // Bass fill on beat 3 — gives the bar motion
    if (bar%2===0) wBass(root*1.25, bT+B*2.5, 0.5, V*0.32);
    else           wBass(root,       bT+B*2,   0.7, V*0.42);

    // Guitar strum beat 2 — slightly rushed for human feel
    guitar(root*2, bT+B-0.008, 1.8, V*0.36);
    // Ghost strum beat 4 — odd bars only
    if (bar%2===1) guitar(root*2, bT+B*3.2, 1.1, V*0.18);

    // Snare: sparse — beat 3, even bars only
    if (bar%2===0) perc(bT+B*2, V*0.22, true);
    // Ghost snare "and" of 2 — bars 3 and 7 (human imperfection)
    if (bar===3||bar===7) perc(bT+B*1.5, V*0.08, true);

    // Hi-hat: 2 taps max per bar
    perc(bT+B,   V*0.08, false);
    if (bar%2===1) perc(bT+B*3, V*0.07, false);
  }

  // Melody — 8-bar phrase, lots of space, Am pentatonic
  // A C D E G A — mournful, resolves on Am
  const mel = [
    // bar, beat, freq, dur_beats
    [0, 0,   N.Am3,  2.5],
    [0, 3,   N.C4,   1],
    [1, 0.5, N.D4,   1.5],
    [1, 2.5, N.Am3,  1.5],
    [2, 0,   N.E4,   2],
    [2, 2.5, N.C4,   1.5],
    [3, 0,   N.Am3,  4],          // long hold — breathe
    [4, 0,   N.C4,   1.5],
    [4, 2,   N.D4,   1],
    [4, 3.5, N.E4,   0.5],
    [5, 0,   N.G4*0.5*2, 2],     // G3
    [5, 2.5, N.E4,   1.5],
    [6, 0,   N.D4,   1.5],
    [6, 2,   N.C4,   1],
    [6, 3.5, N.Am3,  0.5],
    [7, 0,   N.Am3,  3.5],        // resolve — long hold
  ];

  for (const [bar, beat, freq, db] of mel)
    guitar(freq, t + bar*BAR + beat*B, db*B*0.88, V*0.68);

  // Sparse wind — single buffer
  try {
    if (Math.random() > 0.3) {
      const wc=bgmCtx(), ws=Math.floor(wc.sampleRate*BAR*3);
      const wb=wc.createBuffer(1,ws,wc.sampleRate), wd=wb.getChannelData(0);
      for(let i=0;i<ws;i++) wd[i]=(Math.random()*2-1)*Math.sin(i/ws*Math.PI)*0.7;
      const wsrc=wc.createBufferSource(); wsrc.buffer=wb;
      const wf=wc.createBiquadFilter(); wf.type='bandpass';
      wf.frequency.value=200+Math.random()*120; wf.Q.value=0.35;
      const wg=wc.createGain(); wg.gain.value=V*0.028;
      wsrc.connect(wf); wf.connect(wg); wg.connect(BGM.masterGain);
      const startBar=Math.floor(Math.random()*(BARS-3));
      wsrc.start(t+startBar*BAR); wsrc.stop(t+startBar*BAR+BAR*3+0.1);
    }
  } catch(e) {}

  const dur = BARS*BAR;
  BGM.seqTimer = setTimeout(()=>scheduleHoboLoop(t+dur), (dur-0.4)*1000);
}