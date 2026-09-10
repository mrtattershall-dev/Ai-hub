function playSound(type){
  if(!audioCtx) return;
  try{
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const t=audioCtx.currentTime;
    if(type==='kill'){
      o.type='sawtooth';
      o.frequency.setValueAtTime(240,t); o.frequency.exponentialRampToValueAtTime(35,t+0.2);
      g.gain.setValueAtTime(0.35,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
      o.start(t); o.stop(t+0.2);
    } else if(type==='attack'){
      o.type='square';
      o.frequency.setValueAtTime(400,t); o.frequency.exponentialRampToValueAtTime(160,t+0.07);
      g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.07);
      o.start(t); o.stop(t+0.07);
    } else if(type==='graft'){
      // Wet organic slam
      o.type='sine';
      o.frequency.setValueAtTime(60,t); o.frequency.linearRampToValueAtTime(520,t+0.18);
      g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.32);
      o.start(t); o.stop(t+0.32);
    } else if(type==='decay'){
      o.type='sawtooth';
      o.frequency.setValueAtTime(380,t); o.frequency.exponentialRampToValueAtTime(18,t+0.55);
      g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.55);
      o.start(t); o.stop(t+0.55);
    } else if(type==='hb'){
      o.type='sine';
      o.frequency.setValueAtTime(58,t); o.frequency.exponentialRampToValueAtTime(22,t+0.14);
      g.gain.setValueAtTime(0.48,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
      o.start(t); o.stop(t+0.18);
    } else if(type==='spore'){
      o.type='sine';
      o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(60,t+0.3);
      g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o.start(t); o.stop(t+0.3);
    }
  }catch(e){}
}