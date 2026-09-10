function guitar(freq, time, durSec, vol) {
  try {
    const ctx = bgmCtx();
    const osc = ctx.createOscillator();
    const lp  = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * (1+(Math.random()-0.5)*0.003);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, time);
    lp.frequency.exponentialRampToValueAtTime(600, time + durSec*0.5);
    lp.Q.value = 0.8; // softer than banjo's 1.4
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(vol, time + 0.018); // slightly slower attack
    env.gain.exponentialRampToValueAtTime(vol*0.45, time + durSec*0.25); // longer sustain
    env.gain.exponentialRampToValueAtTime(0.0001, time + durSec);
    osc.connect(lp); lp.connect(env);
    env.connect(BGM.masterGain);
    if (BGM.reverbInput) env.connect(BGM.reverbInput);
    osc.start(time); osc.stop(time + durSec + 0.02);
  } catch(e) {}
}