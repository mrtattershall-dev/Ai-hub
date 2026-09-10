function getDahCtx() {
  if (!_dahAudioCtx) _dahAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Browsers suspend AudioContext until a user gesture — resume it on every call so
  // sounds work after the first interaction regardless of when the context was created
  if (_dahAudioCtx.state === 'suspended') _dahAudioCtx.resume();
  return _dahAudioCtx;
}