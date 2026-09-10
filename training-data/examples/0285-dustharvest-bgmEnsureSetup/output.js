function bgmEnsureSetup() {
  const ctx = bgmCtx();
  if (!BGM.masterGain) {
    // Compressor on master bus — prevents clipping when many notes stack
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;  // start compressing at -14dB
    comp.knee.value = 6;         // soft knee
    comp.ratio.value = 3;        // gentle 3:1 ratio
    comp.attack.value = 0.003;   // 3ms attack — catch transients
    comp.release.value = 0.18;   // 180ms release
    comp.connect(ctx.destination);
    BGM._comp = comp;

    BGM.masterGain = ctx.createGain();
    BGM.masterGain.gain.value = bgmMasterLevel();
    BGM.masterGain.connect(comp); // masterGain → compressor → destination
  }
  if (!BGM.reverbInput) {
    try {
      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.10;
      reverbReturn.connect(BGM.masterGain);

      const delay1 = ctx.createDelay(1.0); delay1.delayTime.value = 0.11;
      const delay2 = ctx.createDelay(1.0); delay2.delayTime.value = 0.07;
      const fb1 = ctx.createGain(); fb1.gain.value = 0.20;
      const fb2 = ctx.createGain(); fb2.gain.value = 0.12;

      delay1.connect(fb1); fb1.connect(delay2);
      delay2.connect(fb2); fb2.connect(delay1);
      delay1.connect(reverbReturn);
      delay2.connect(reverbReturn);

      BGM.reverbInput = delay1;
    } catch(e) { BGM.reverbInput = null; }
  }
}