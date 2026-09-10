function scheduleBadlandsLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'badlands') return;
  bgmEnsureSetup();
  const V=0.56, BPM=92, B=60/BPM, BAR=B*4, BARS=8, t=startTime;
  // E - D - A - E - E - D - A - B
  const bass_r=[N.E2,N.D2,N.A2,N.E2,N.E2,N.D2,N.A2,N.B2];
  const chord_r=[N.E3,N.D3,N.A3,N.E3,N.E3,N.D3,N.A3,N.B2*2];

  for(let bar=0;bar<BARS;bar++){
    const bT=t+bar*BAR, root=bass_r[bar];
    // Bass: driving 8th-note pulse but with accents on 1 and 3
    for(let e=0;e<8;e++) {
      const isDown = e%2===0;
      const vol = e===0 ? V*0.92 : e===4 ? V*0.78 : isDown ? V*0.58 : V*0.42;
      wBass(root, bT+e*B*0.5, 0.28, vol);
    }
    // Accent 5th on beat 2.5 for Mixolydian color
    wBass(root*1.5, bT+B*2.5, 0.32, V*0.55);

    // Strum on beats 1, 2.5, 3 — not every 8th
    strum(chord_r[bar], bT,       V*0.46);
    strum(chord_r[bar], bT+B*2,   V*0.42);
    // Synco chop on "and" of 2
    banjo(chord_r[bar], bT+B*1.5, B*0.16, V*0.30);

    // Snare on 2 and 4
    perc(bT+B,   V*0.52, true);
    perc(bT+B*3, V*0.48, true);
    // Ghost on "and" of 4
    if(bar%2===1) perc(bT+B*3.5, V*0.14, true);

    // Hi-hat: country shuffle — accent on 2 and 4, light off-beats
    // Pattern per beat: 8th + 16th rest + 16th (shuffle feel)
    perc(bT,       V*0.08, false); // 1
    perc(bT+B*0.5, V*0.11, false); // and-1
    perc(bT+B,     V*0.16, false); // 2 (snare)
    perc(bT+B*1.5, V*0.10, false); // and-2
    perc(bT+B*2,   V*0.09, false); // 3
    perc(bT+B*2.5, V*0.13, false); // and-3 (accent — synco)
    perc(bT+B*3,   V*0.16, false); // 4 (snare)
    perc(bT+B*3.5, V*0.11, false); // and-4
  }
  // Lead: E Mixolydian — E F# G# A B C# D (flat 7 = D natural)
  const Gs3=N.E3*1.587, Cs4=N.E4*0.891; // G#3, C#4
  const mel=[
    [0,0,N.E4,0.5],[0,0.5,N.D4,0.5],[0,1,N.B3,0.75],[0,2,N.A3,0.5],[0,2.75,N.E4,1.25],
    [1,0,N.D4,0.5],[1,0.75,Cs4,0.25],[1,1.25,N.B3,0.5],[1,2,N.A3,2],
    [2,0,N.E4,0.5],[2,0.5,N.Fs4,0.5],[2,1,N.G4,0.5],[2,1.75,N.Fs4,0.25],[2,2,N.E4,2],
    [3,0,N.B3,0.5],[3,0.75,N.D4,0.5],[3,1.5,N.E4,2.5],
    [4,0,N.E4,0.5],[4,0.5,N.D4,0.75],[4,1.5,N.A3,0.5],[4,2.25,N.B3,1.75],
    [5,0,N.Fs4,0.5],[5,0.75,N.E4,0.5],[5,1.5,N.D4,0.5],[5,2.25,Cs4,1.75],
    [6,0,N.A3,0.5],[6,0.75,N.B3,0.5],[6,1.5,N.D4,0.5],[6,2.25,N.E4,1.75],
    [7,0,N.D4,0.75],[7,1,N.B3,0.75],[7,2,N.Fs3,2],
  ];
  for(const [bar,beat,freq,db] of mel)
    banjo(freq, t+bar*BAR+beat*B, db*B*0.80, V*0.68);
  // Heat shimmer — single buffer, continuous high-freq texture across all bars
  try {
    const hc=bgmCtx(), hs=Math.floor(hc.sampleRate*BAR*BARS);
    const hb=hc.createBuffer(1,hs,hc.sampleRate), hd=hb.getChannelData(0);
    for(let i=0;i<hs;i++) hd[i]=(Math.random()*2-1)*0.5;
    const hsrc=hc.createBufferSource(); hsrc.buffer=hb;
    const hf=hc.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=4200; hf.Q.value=0.3;
    const hg=hc.createGain(); hg.gain.value=V*0.018;
    hsrc.connect(hf); hf.connect(hg); hg.connect(BGM.masterGain);
    hsrc.start(t); hsrc.stop(t+BAR*BARS+0.1);
  }catch(e){}
  const dur=BARS*BAR;
  BGM.seqTimer=setTimeout(()=>scheduleBadlandsLoop(t+dur),(dur-0.4)*1000);
}