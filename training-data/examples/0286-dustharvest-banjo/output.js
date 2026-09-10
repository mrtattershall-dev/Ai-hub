function banjo(freq, time, durSec, vol) {
  try {
    const ctx = bgmCtx();
    const osc = ctx.createOscillator();
    const lp  = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * (1+(Math.random()-0.5)*0.003);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, time);
    lp.frequency.exponentialRampToValueAtTime(800, time + durSec*0.4);
    lp.Q.value = 1.2;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(vol*0.85, time + 0.008);
    env.gain.exponentialRampToValueAtTime(vol*0.22, time + durSec*0.15);
    env.gain.exponentialRampToValueAtTime(0.0001, time + durSec);
    osc.connect(lp); lp.connect(env);
    env.connect(BGM.masterGain);
    // Reverb send — only if available and at reduced level
    if (BGM.reverbInput) {
      const rvSend = ctx.createGain(); rvSend.gain.value = 0.08;
      env.connect(rvSend); rvSend.connect(BGM.reverbInput);
    }
    osc.start(time); osc.stop(time + durSec + 0.02);
  } catch(e) {}
}