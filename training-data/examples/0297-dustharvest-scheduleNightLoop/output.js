function scheduleNightLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'night') return;
  bgmEnsureSetup();
  const V=0.52, BPM=56, B=60/BPM, BAR=B*4, BARS=4, t=startTime;

  const mel = [
    [0,0,N.Am3,3],[0,3.5,N.C4,0.5],
    [1,0,N.Em4,2],[1,2.5,N.C4,1.5],
    [2,0,N.Am3,2.5],[2,3,N.Em3,1],
    [3,0,N.Am2,4],
  ];

  for (let bar=0; bar<BARS; bar++) {
    const bT=t+bar*BAR;
    wBass(N.Am2, bT, 1.1, V*0.75);
    if (bar%2===0) wBass(N.Em3, bT+B*2, 0.9, V*0.48);
    if (bar%2===1) strum(N.Am3, bT+B*2, V*0.28);
  }
  for (const [bar,beat,freq,db] of mel)
    banjo(freq, t+bar*BAR+beat*B, db*B*0.82, V*0.62);
  // Wind — single buffer for whole loop
  try {
    const wc=bgmCtx(), ws=Math.floor(wc.sampleRate*BAR*BARS);
    const wb=wc.createBuffer(1,ws,wc.sampleRate), wd=wb.getChannelData(0);
    for(let i=0;i<ws;i++) wd[i]=(Math.random()*2-1)*Math.sin(i/ws*Math.PI);
    const wsrc=wc.createBufferSource(); wsrc.buffer=wb;
    const wf=wc.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=290; wf.Q.value=0.42;
    const wg=wc.createGain(); wg.gain.value=V*0.048;
    wsrc.connect(wf); wf.connect(wg); wg.connect(BGM.masterGain);
    wsrc.start(t); wsrc.stop(t+BAR*BARS+0.1);
  } catch(e) {}

  const dur=BARS*BAR;
  BGM.seqTimer = setTimeout(()=>scheduleNightLoop(t+dur), (dur-0.4)*1000);
}