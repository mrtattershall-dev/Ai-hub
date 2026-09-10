function doJoin(rawCode, guestName) {
  cleanupAll();
  mp.role = 'guest';
  player.name = guestName || player.name || 'Stranger';
  renderPanel();
  _dhLoadPeerJS(function(err) {
    if (err) { showMsg('⚠️ ' + err.message); mp.role = null; renderPanel(); return; }

    // If it looks like a plain custom code (no DH- prefix, no hyphens), add the prefix
    const hostPeerId = rawCode.startsWith('DH-') ? rawCode
      : /^[a-zA-Z0-9]+$/.test(rawCode) && rawCode.length <= 24 ? 'DH-' + rawCode.toUpperCase()
      : rawCode; // fallback: use as-is (legacy long PeerJS IDs)

    const peer = new Peer({ config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]}});
    mp.peer = peer;

  peer.on('open', () => {
    mp.peerId = peer.id;
    const conn = peer.connect(hostPeerId, { reliable: true });
    mp.hostConn = conn;

    conn.on('open', () => {
      mp.partnerReady = true;
      startTimers();
      showMsg('🌐 Connected! Loading world…');
      updateBadge(); renderPanel();
      hideTitleScreen_mp();
    });

    conn.on('data', msg => {
      if (msg.type === 'world_state') { applyWorldState(msg); return; }
      if (msg.type === 'plot_patch')  { applyPlotPatch(msg.patches); return; }
      if (msg.type === 'tile_patch')  { applyTilePatch(msg); return; }
      if (msg.type === 'pos' && msg._pid) {
        mp.remotePlayers[msg._pid] = msg; return;
      }
      if (msg.type === 'player_left') {
        delete mp.remotePlayers[msg.id];
        delete _remoteRenderPos[msg.id];
        showMsg(`🌐 ${msg.name||'A player'} left.`); return;
      }
      if (msg.type === 'chat') {
        showMsg(`💬 ${msg.senderName||'Partner'}: ${(msg.text||'').slice(0,120)}`, 4000); return;
      }
      if (msg.type === 'error') { showMsg(`⚠️ ${msg.msg}`); return; }
      if (msg.type === 'chest_update')    { applyChestUpdate(msg);    return; }
      if (msg.type === 'debt_update')     { applyDebtUpdate(msg);     return; }
      if (msg.type === 'upgrades_update') { applyUpgradesUpdate(msg); return; }
      if (msg.type === 'sync_request')    { return; } // host-only
    });

    conn.on('close', () => {
      stopTimers();
      mp.partnerReady = false;
      mp.remotePlayers = {};
      showMsg('🌐 Disconnected from host.');
      updateBadge(); renderPanel();
    });

    conn.on('error', () => {
      const el = document.getElementById('dhMpJoinStatus');
      if (el) el.textContent = '⚠️ Could not connect. Check the room code.';
      showMsg('⚠️ Could not connect to host. Check the room code.');
    });
  });

  peer.on('error', err => {
    const msgs = {
      'peer-unavailable': 'Room not found. Check the code — host must be online first.',
      'server-error':     'Relay server error. Try again in a moment.',
      'disconnected':     'Lost connection to relay server. Check your internet.',
      'browser-incompatible': 'Your browser does not support WebRTC multiplayer.',
    };
    const txt = msgs[err.type] || 'Error: ' + err.type;
    const el = document.getElementById('dhMpJoinStatus');
    if (el) el.textContent = '⚠️ ' + txt;
    showMsg('⚠️ ' + txt);
  });
  }); // end _dhLoadPeerJS
}