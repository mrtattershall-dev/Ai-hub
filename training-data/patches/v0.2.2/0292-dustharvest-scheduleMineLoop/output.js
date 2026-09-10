function scheduleMineLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'mine') return;
  bgmEnsureSetup();
  const V=0.50, BPM=70, B=60/BPM, BAR=B*4, BARS=8, t=startTime;
  // Em - Em - D - D - C - C - B - Em
  const bass_r=[N.E2,N.E2,N.D2,N.D2,N.C3,N.C3,N.B2,N.E2];

  for(let bar=0;bar<BARS;bar++){
    const bT=t+bar*BAR, root=bass_r[bar];
    // Kick (low perc) on beat 1 — separate from snare
    perc(bT,     V*0.42, false);
    // Bass: heavy on 1, shorter on 3, synco on "and" of 2
    wBass(root,      bT,       0.85, V*0.95);
    wBass(root,      bT+B*2,   0.65, V*0.72);
    wBass(root*1.5,  bT+B*1.5, 0.30, V*0.38); // "and" of 2 — synco
    // Snare on 2 and 4 — NOT beat 1
    perc(bT+B,   V*0.58, true);
    perc(bT+B*3, V*0.52, true);
    // Ghost on "and" of 3
    if(bar%2===0) perc(bT+B*2.5, V*0.14, true);
    // Hi-hat: quarter notes only — gives space, heavy rock feel
    perc(bT,       V*0.10, false);
    perc(bT+B,     V*0.10, false);
    perc(bT+B*2,   V*0.10, false);
    perc(bT+B*3,   V*0.10, false);
    // Power chord stabs on UPBEATS (and-of-2, and-of-4) — tension not mud
    [1, 1.189, 1.498].forEach((r,i)=>{
      banjo(root*r*2, bT+B*1.5+i*0.014, B*0.20, V*0.28); // and-of-2
      banjo(root*r*2, bT+B*3.5+i*0.014, B*0.16, V*0.24); // and-of-4
    });
  }
  // Riff: E minor pentatonic descending (E G A B D)
  const riff=[
    [0,0,N.E4,0.5],[0,0.75,N.D4,0.5],[0,1.5,N.B3,0.75],[0,2.5,N.A3,0.5],[0,3.25,N.G3,0.75],
    [1,0,N.E3,1.5],[1,2,N.B3,0.5],[1,3,N.D4,1],
    [2,0,N.E4,0.5],[2,0.75,N.D4,0.5],[2,1.5,N.C4,0.75],[2,2.5,N.G3,1.5],
    [3,0,N.E3,2],[3,2.5,N.Fs3,0.5],[3,3.25,N.E3,0.75],
    [4,0,N.E4,0.5],[4,0.75,N.D4,0.5],[4,1.5,N.B3,0.75],[4,2.5,N.A3,0.5],[4,3.25,N.G3,0.75],
    [5,0,N.E3,1.5],[5,2,N.A3,0.5],[5,3,N.B3,1],
    [6,0,N.C4,0.5],[6,0.75,N.B3,0.5],[6,1.5,N.A3,0.75],[6,2.5,N.G3,1.5],
    [7,0,N.E3,3.5],
  ];
  for(const [bar,beat,freq,db] of riff)
    banjo(freq, t+bar*BAR+beat*B, db*B*0.84, V*0.58);
  // Cave settle — single pre-generated buffer, scheduled at different times
  try {
    const mc=bgmCtx(), ms=Math.floor(mc.sampleRate*0.4);
    const mb=mc.createBuffer(1,ms,mc.sampleRate), md=mb.getChannelData(0);
    for(let i=0;i<ms;i++) md[i]=(Math.random()*2-1)*Math.exp(-i/(ms*0.3));
    const mf=mc.createBiquadFilter(); mf.type='lowpass'; mf.frequency.value=140; mf.Q.value=0.5;
    for(let bar=0;bar<BARS;bar+=2){
      const msrc=mc.createBufferSource(); msrc.buffer=mb;
      const mg=mc.createGain(); mg.gain.value=V*0.16;
      msrc.connect(mf); mf.connect(mg); mg.connect(BGM.masterGain);
      msrc.start(t+bar*BAR+B*3.7); msrc.stop(t+bar*BAR+B*3.7+0.5);
    }
  }catch(e){}
  const dur=BARS*BAR;
  BGM.seqTimer=setTimeout(()=>scheduleMineLoop(t+dur),(dur-0.4)*1000);
}