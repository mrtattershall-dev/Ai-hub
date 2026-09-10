function bgmStart() {
  if (BGM.running) return;
  BGM.running = true;
  if (settings.musicOn === false) return;
  bgmEnsureSetup();
  const ctx=bgmCtx();
  const h=(gameState.timeOfDay||0)/60;
  const isNight=h>=20||h<6;
  if      (gameState.inHoboCamp)  BGM.mode='hobo';
  else if (gameState.inOcean)     BGM.mode='ocean';
  else if (gameState.inMine)      BGM.mode='mine';
  else if (gameState.inBadlands)  BGM.mode='badlands';
  else if (gameState.zone==='Wilderness') BGM.mode=isNight?'night':'wilderness';
  else    BGM.mode=isNight?'night':'day';
  BGM.masterGain.gain.cancelScheduledValues(ctx.currentTime);
  BGM.masterGain.gain.setValueAtTime(0,ctx.currentTime);
  BGM.masterGain.gain.linearRampToValueAtTime(bgmMasterLevel(),ctx.currentTime+2.5);
  const s=ctx.currentTime+0.3;
  if(BGM.mode==='day')        scheduleDayLoop(s);
  if(BGM.mode==='night')      scheduleNightLoop(s);
  if(BGM.mode==='mine')       scheduleMineLoop(s);
  if(BGM.mode==='badlands')   scheduleBadlandsLoop(s);
  if(BGM.mode==='wilderness') scheduleWildernessLoop(s);
  if(BGM.mode==='town')       scheduleTownLoop(s);
  if(BGM.mode==='hobo')       scheduleHoboLoop(s);
  if(BGM.mode==='ocean')      scheduleOceanLoop(s);
}