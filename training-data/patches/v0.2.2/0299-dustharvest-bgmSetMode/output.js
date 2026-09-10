function bgmSetMode(newMode) {
  if (BGM.mode === newMode) return;
  if (settings.musicOn === false) return;
  // Clear ALL pending timers before switching
  if (BGM.seqTimer) { clearTimeout(BGM.seqTimer); BGM.seqTimer = null; }
  BGM.mode = newMode;
  bgmEnsureSetup();
  if (!BGM.masterGain) return;
  const ctx=bgmCtx();
  // Fade out current sound
  BGM.masterGain.gain.cancelScheduledValues(ctx.currentTime);
  BGM.masterGain.gain.setValueAtTime(BGM.masterGain.gain.value, ctx.currentTime);
  BGM.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime+0.30);
  BGM.seqTimer = setTimeout(()=>{
    if (!BGM.running || BGM.mode !== newMode) return; // guard: mode may have changed again
    if (BGM.seqTimer) { clearTimeout(BGM.seqTimer); BGM.seqTimer = null; }
    BGM.masterGain.gain.cancelScheduledValues(bgmCtx().currentTime);
    BGM.masterGain.gain.setValueAtTime(bgmMasterLevel(), bgmCtx().currentTime);
    const s=bgmCtx().currentTime+0.05;
    if (newMode==='day')        scheduleDayLoop(s);
    if (newMode==='night')      scheduleNightLoop(s);
    if (newMode==='combat')     scheduleCombatLoop(s);
    if (newMode==='hobo')       scheduleHoboLoop(s);
    if (newMode==='ocean')      scheduleOceanLoop(s);
    if (newMode==='mine')       scheduleMineLoop(s);
    if (newMode==='badlands')   scheduleBadlandsLoop(s);
    if (newMode==='wilderness') scheduleWildernessLoop(s);
    if (newMode==='town')       scheduleTownLoop(s);
  }, 320);
}