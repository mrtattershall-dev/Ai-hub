function bgmStop() {
  BGM.running = false; BGM.mode = null;
  if (BGM.seqTimer) clearTimeout(BGM.seqTimer);
  BGM.seqTimer = null;
  if (BGM.masterGain) {
    const ctx=bgmCtx();
    BGM.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    BGM.masterGain.gain.setValueAtTime(BGM.masterGain.gain.value, ctx.currentTime);
    BGM.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime+0.6);
  }
}