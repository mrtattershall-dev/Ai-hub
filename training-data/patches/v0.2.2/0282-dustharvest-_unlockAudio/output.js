function _unlockAudio() {
  if (_dahAudioCtx && _dahAudioCtx.state === 'suspended') _dahAudioCtx.resume();
  if (!_dahAudioCtx) {
    // Create it now so it starts in running state (gesture active)
    try { _dahAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
}