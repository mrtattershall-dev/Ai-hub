function playTone(freq, type='sawtooth', dur=0.08, vol=0.15, detune=0) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 800;
  osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
  osc.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}