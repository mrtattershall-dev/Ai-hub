function playNoise(dur=0.05, vol=0.3, freq=400) {
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  const src = audioCtx.createBufferSource();
  const filt = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 2;
  src.buffer = buf; src.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.start();
}