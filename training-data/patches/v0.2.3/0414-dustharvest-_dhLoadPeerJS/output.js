function _dhLoadPeerJS(callback) {
  if (typeof Peer !== 'undefined') { callback(null); return; }
  const cdns = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  ];
  let tried = 0;
  function tryNext() {
    if (tried >= cdns.length) { callback(new Error('Could not load PeerJS from any CDN. Check your internet connection.')); return; }
    const s = document.createElement('script');
    s.src = cdns[tried++];
    s.onload = () => { if (typeof Peer !== 'undefined') callback(null); else tryNext(); };
    s.onerror = tryNext;
    document.head.appendChild(s);
  }
  tryNext();
}