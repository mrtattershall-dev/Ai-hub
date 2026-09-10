function dSound(type) {
  if (!_soundEnabled) return;
  try {
    const ctx = getDahCtx();
    const t   = ctx.currentTime;
    const vol = _soundVol;

    switch(type) {
      case 'step': {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 80 + Math.random()*20;
        g.gain.setValueAtTime(0.04*vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t+.08);
        o.start(t); o.stop(t+.08); break;
      }
      case 'tool': {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square'; o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(110, t+.08);
        g.gain.setValueAtTime(0.07*vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t+.12);
        o.start(t); o.stop(t+.12); break;
      }
      case 'harvest': {
        [440,550,660].forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='triangle'; o.frequency.value=f;
          g.gain.setValueAtTime(0.06*vol, t+i*.05);
          g.gain.exponentialRampToValueAtTime(0.001, t+i*.05+.15);
          o.start(t+i*.05); o.stop(t+i*.05+.15);
        }); break;
      }
      case 'sell': {
        [523,659,784].forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=f;
          g.gain.setValueAtTime(0.08*vol, t+i*.07);
          g.gain.exponentialRampToValueAtTime(0.001, t+i*.07+.2);
          o.start(t+i*.07); o.stop(t+i*.07+.2);
        }); break;
      }
      case 'hit': {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sawtooth'; o.frequency.setValueAtTime(180,t);
        o.frequency.exponentialRampToValueAtTime(60,t+.1);
        g.gain.setValueAtTime(0.12*vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+.12);
        o.start(t); o.stop(t+.12); break;
      }
      case 'hurt': {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sawtooth'; o.frequency.setValueAtTime(300,t);
        o.frequency.exponentialRampToValueAtTime(80,t+.2);
        g.gain.setValueAtTime(0.15*vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+.25);
        o.start(t); o.stop(t+.25); break;
      }
      case 'buy': {
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='triangle'; o.frequency.setValueAtTime(440,t);
        o.frequency.setValueAtTime(660,t+.07);
        g.gain.setValueAtTime(0.07*vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+.18);
        o.start(t); o.stop(t+.18); break;
      }
      case 'ui': {
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sine'; o.frequency.value=660;
        g.gain.setValueAtTime(0.05*vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+.1);
        o.start(t); o.stop(t+.1); break;
      }
      case 'night': {
        // Low ominous drone
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type='sine'; o.frequency.setValueAtTime(60,t);
        o.frequency.linearRampToValueAtTime(40,t+1.5);
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(0.12*vol,t+.4);
        g.gain.linearRampToValueAtTime(0,t+1.5);
        o.start(t); o.stop(t+1.5); break;
      }
      case 'dawn': {
        [330,440,550,660].forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='triangle'; o.frequency.value=f;
          g.gain.setValueAtTime(0.06*vol,t+i*.1);
          g.gain.exponentialRampToValueAtTime(0.001,t+i*.1+.3);
          o.start(t+i*.1); o.stop(t+i*.1+.35);
        }); break;
      }
      case 'victory': {
        const notes=[261,330,392,523,659,784,1047];
        notes.forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = i<3?'sawtooth':'triangle';
          o.frequency.value=f;
          g.gain.setValueAtTime(0,t+i*.12);
          g.gain.linearRampToValueAtTime(0.10*vol,t+i*.12+.05);
          g.gain.exponentialRampToValueAtTime(0.001,t+i*.12+.6);
          o.start(t+i*.12); o.stop(t+i*.12+.65);
        }); break;
      }
      case 'save': {
        [440,523].forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=f;
          g.gain.setValueAtTime(0.05*vol,t+i*.08);
          g.gain.exponentialRampToValueAtTime(0.001,t+i*.08+.15);
          o.start(t+i*.08); o.stop(t+i*.08+.15);
        }); break;
      }
    }
  } catch(e) {}
}