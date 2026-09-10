function init() {
  if (ctx) return;  /* idempotent */

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {
    console.warn('[audio] WebAudio not available:', e);
    return;
  }

  /* CRITICAL: always read sampleRate from context — never hardcode */
  SR = ctx.sampleRate;
  if (DEBUG) console.log(`[audio] context created, sampleRate=${SR}Hz`);

  /* Master gain — all nodes route here */
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
  masterGain.connect(ctx.destination);

  /* Build waveforms */
  waveP125 = buildPulse(0.125);
  waveP25  = buildPulse(0.25);
  waveP50  = buildPulse(0.50);
  waveTri  = buildSteppedTriangle();

  /* Build long-mode noise buffer once (short-mode built on demand) */
  noiseBuffer = buildNoiseBuffer(false);

  /* Dummy ScriptProcessorNode — forces browser to keep audio thread alive
     when tab is backgrounded, preventing scheduler stutter.
     ScriptProcessorNode is deprecated but remains the only reliable
     single-file solution (AudioWorklet requires an external module URL
     or a Blob URL which requires careful CSP handling; the Blob approach
     works but the ScriptProcessor is simpler and sufficient for jam). */
  try {
    dummyNode = ctx.createScriptProcessor(4096, 0, 1);
    dummyNode.onaudioprocess = function() { runScheduler(); };
    dummyNode.connect(ctx.destination);
  } catch(e) {
    /* Fallback: scheduler runs purely on setTimeout — acceptable */
    if (DEBUG) console.log('[audio] ScriptProcessor unavailable, using setTimeout only');
  }

  ctx.resume().then(() => {
    ready = true;
    startScheduler();
    if (DEBUG) console.log('[audio] ready');
  });
}