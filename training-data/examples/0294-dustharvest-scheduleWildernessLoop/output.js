function scheduleWildernessLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'wilderness') return;
  bgmEnsureSetup();
  const V=0.48, BPM=66, B=60/BPM, BAR=B*4, BARS=8, t=startTime;
  // Dm - Am - C - Dm - Dm - G - Am - Dm
  const bass_r=[N.D2,N.A2,N.C3,N.D2,N.D2,N.G2,N.A2,N.D2];
  const chord_r=[N.D3,N.A3,N.C4,N.D3,N.D3,N.G3,N.A3,N.D3];

  for(let bar=0;bar<BARS;bar++){
    const bT=t+bar*BAR, root=bass_r[bar], chord=chord_r[bar];
    wBass(root, bT, 0.9, V*0.72);
    if(bar%2===0) wBass(root*1.5, bT+B*1.5, 0.6, V*0.38);
    wBass(root, bT+B*2, 0.8, V*0.58);
    // Fingerpicking: root-3rd-5th-3rd arpeggio
    const m3=chord*1.189, p5=chord*1.498;
    banjo(chord, bT+B*0.5,  B*0.35, V*0.26);
    banjo(m3,    bT+B*0.75, B*0.35, V*0.22);
    banjo(p5,    bT+B*1,    B*0.35, V*0.24);
    banjo(m3,    bT+B*1.5,  B*0.35, V*0.20);
    banjo(chord, bT+B*2.5,  B*0.35, V*0.22);
    banjo(p5,    bT+B*2.75, B*0.35, V*0.20);
    banjo(m3,    bT+B*3,    B*0.35, V*0.18);
    banjo(chord, bT+B*3.5,  B*0.35, V*0.16);
    if(bar%2===0) perc(bT+B*2, V*0.18, true);
    perc(bT,V*0.08,false); perc(bT+B,V*0.06,false);
    perc(bT+B*2,V*0.08,false); perc(bT+B*3,V*0.06,false);
  }
  // Melody: D Dorian — D E F G A B C
  // B natural = raised 6th (the Dorian brightness)
  const mel=[
    [0,0,N.D4,1.5],[0,1.75,N.E4,0.5],[0,2.5,N.F4,1.5],
    [1,0,N.A4,2],[1,2.5,N.G4,1.5],
    [2,0,N.C5,1],[2,1.25,N.B4,0.75],[2,2.25,N.A4,0.5],[2,3,N.G4,1],
    [3,0,N.D4,3.5],
    [4,0,N.F4,0.75],[4,1,N.A4,0.5],[4,1.75,N.B4,0.75],[4,2.75,N.A4,0.5],[4,3.5,N.G4,0.5],
    [5,0,N.E4,1],[5,1.25,N.D4,0.75],[5,2.25,N.C4,2],
    [6,0,N.A3,0.5],[6,0.75,N.C4,0.5],[6,1.5,N.D4,0.5],[6,2.25,N.E4,0.5],[6,3,N.G4,1],
    [7,0,N.D4,3.5],
  ];
  for(const [bar,beat,freq,db] of mel)
    guitar(freq, t+bar*BAR+beat*B, db*B*0.85, V*0.62);
  // Wind — single buffer for full loop duration
  try {
    const wc=bgmCtx(), ws=Math.floor(wc.sampleRate*BAR*BARS);
    const wb=wc.createBuffer(1,ws,wc.sampleRate), wd=wb.getChannelData(0);
    // Shaped wind: swells with sine envelope
    for(let i=0;i<ws;i++) wd[i]=(Math.random()*2-1)*0.7*(0.5+0.5*Math.sin(i/ws*Math.PI*4));
    const wsrc=wc.createBufferSource(); wsrc.buffer=wb;
    const wf=wc.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=380; wf.Q.value=0.45;
    const wg=wc.createGain(); wg.gain.value=V*0.038;
    wsrc.connect(wf); wf.connect(wg); wg.connect(BGM.masterGain);
    wsrc.start(t); wsrc.stop(t+BAR*BARS+0.1);
  }catch(e){}
  const dur=BARS*BAR;
  BGM.seqTimer=setTimeout(()=>scheduleWildernessLoop(t+dur),(dur-0.4)*1000);
}