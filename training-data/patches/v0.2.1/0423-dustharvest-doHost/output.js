function doHost(customCode) {
  cleanupAll();
  mp.role = 'host';
  renderPanel(); // show "connecting" state immediately
  _dhLoadPeerJS(function(err) {
    if (err) { showMsg('⚠️ ' + err.message); mp.role = null; renderPanel(); return; }
    const peerId = makeRoomPeerId(customCode);
    // Add Google STUN servers for reliable LAN + internet NAT traversal
    const peerCfg = { config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]}};
    const peer = peerId ? new Peer(peerId, peerCfg) : new Peer(peerCfg);
    mp.peer = peer;

  peer.on('open', id => {
    mp.peerId = id;
    renderPanel();
    showMsg('🌐 Hosting! Share your code with your family.');
  });

  peer.on('connection', conn => {
    if (mp.guestCount() >= MAX_PLAYERS - 1) {
      conn.on('open', () => conn.send({ type:'error', msg:'Game is full (4 players max).' }));
      setTimeout(() => conn.close(), 1000);
      return;
    }
    setupGuestConn(conn);
  });

  peer.on('error', err => {
    const msgs = {
      'unavailable-id': 'Room code already in use — try a different code or leave blank for random.',
      'peer-unavailable': 'Could not reach guest. They may have disconnected.',
      'server-error': 'Relay server error — try again in a moment.',
      'disconnected': 'Lost connection to relay server. Check your internet.',
      'browser-incompatible': 'Your browser does not support WebRTC multiplayer.',
    };
    showMsg(`⚠️ ${msgs[err.type] || 'Connection error: ' + err.type}`);
    if (err.type !== 'peer-unavailable') { cleanupAll(); renderPanel(); }
  });
  }); // end _dhLoadPeerJS
}