function wBass(freq, time, durSec, vol) {
  try {
    const ctx = bgmCtx();
    const o  = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const hp = ctx.createBiquadFilter(); // cut pure sub
    const g  = ctx.createGain();
    const g2 = ctx.createGain();
    const env= ctx.createGain();
    o.type='sine';  o.frequency.value = freq;
    o2.type='triangle'; o2.frequency.value = freq*2; // triangle 2nd harmonic — more presence
    hp.type='highpass'; hp.frequency.value = 55; // cut below 55Hz — avoid mud
    g.gain.value=0.78; g2.gain.value=0.22;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(vol, time+0.012);
    env.gain.setValueAtTime(vol*0.72, time+durSec*0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, time+durSec);
    o.connect(g); o2.connect(g2);
    g.connect(hp); g2.connect(hp);
    hp.connect(env); env.connect(BGM.masterGain);
    o.start(time); o.stop(time+durSec+0.02);
    o2.start(time); o2.stop(time+durSec+0.02);
  } catch(e) {}
}