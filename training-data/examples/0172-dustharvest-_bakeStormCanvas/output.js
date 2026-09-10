function _bakeStormCanvas(viewW, viewH, intensity) {
  const W = Math.ceil(viewW), H = Math.ceil(viewH);
  // FIX: clamp intensity to nearest 0.1 for cache key so peak breathing (~±0.08) doesn't rebake
  const cacheIntensity = Math.round(intensity * 10) / 10;
  if (!_storm.oc || _storm.ocW !== W || _storm.ocH !== H || _storm.lastIntensity !== cacheIntensity) {
    _storm.oc = document.createElement('canvas');
    _storm.oc.width  = W * 2; // 2× wide for seamless scroll
    _storm.oc.height = H;
    _storm.ocW = W; _storm.ocH = H;
    _storm.lastIntensity = cacheIntensity;
    const fc = _storm.oc.getContext('2d');
    fc.clearRect(0, 0, W * 2, H);

    const STREAKS = Math.floor(40 + intensity * 60);
    for (let i = 0; i < STREAKS; i++) {
      const seed = i * 6271;
      const yFrac = ((seed * 2246822519) >>> 0) / 0xFFFFFFFF;
      const xFrac = ((seed * 1664525)    >>> 0) / 0xFFFFFFFF;
      const len   = 10 + (((seed * 3266489917) >>> 0) / 0xFFFFFFFF) * 28;
      const thick = 0.6 + (((seed * 374761393)  >>> 0) / 0xFFFFFFFF) * 1.6;
      const alpha = (0.3 + (((seed * 668265263)  >>> 0) / 0xFFFFFFFF) * 0.5) * intensity;
      const fy = yFrac * H;
      const fx = xFrac * W * 2;
      fc.globalAlpha = alpha;
      fc.strokeStyle = '#daa84a';
      fc.lineWidth = thick;
      fc.beginPath();
      fc.moveTo(fx, fy);
      fc.lineTo(fx + len, fy + 0.5);
      fc.stroke();
    }

    // FIX: grit drawn as individual fills (not batched) so each dot gets its own alpha
    const GRIT = Math.floor(40 + intensity * 60);
    fc.fillStyle = '#be8232';
    for (let i = 0; i < GRIT; i++) {
      const seed = i * 9311 + 1000;
      const yFrac = ((seed * 2246822519) >>> 0) / 0xFFFFFFFF;
      const xFrac = ((seed * 1597334677) >>> 0) / 0xFFFFFFFF;
      const size  = 0.8 + (((seed * 3266489917) >>> 0) / 0xFFFFFFFF) * 1.8;
      const fy = yFrac * H;
      const fx = xFrac * W * 2;
      fc.globalAlpha = (0.2 + (((seed * 374761393) >>> 0) / 0xFFFFFFFF) * 0.4) * intensity;
      fc.beginPath();
      fc.arc(fx, fy, size, 0, Math.PI * 2);
      fc.fill();
    }
  }
}