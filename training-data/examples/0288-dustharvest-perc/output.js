function perc(time, vol, isSnare) {
  try {
    const ctx=bgmCtx();
    const sz=Math.floor(ctx.sampleRate*0.09);
    const buf=ctx.createBuffer(1,sz,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<sz;i++) d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource(); src.buffer=buf;
    const f=ctx.createBiquadFilter();
    f.type=isSnare?'bandpass':'highpass';
    f.frequency.value=isSnare?220:6500; f.Q.value=isSnare?0.7:0.5;
    const g=ctx.createGain();
    g.gain.setValueAtTime(vol,time);
    g.gain.exponentialRampToValueAtTime(0.0001,time+(isSnare?0.2:0.05));
    src.connect(f); f.connect(g); g.connect(BGM.masterGain);
    src.start(time); src.stop(time+0.25);
  } catch(e) {}
}