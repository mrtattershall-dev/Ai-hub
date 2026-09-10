function renderPanel(){
  if(!panelVisible)return;

  if(!mp.role){
    mpPanel.innerHTML=`
      <div class="dhmp-section">🌐 CO-OP MULTIPLAYER</div>
      <div class="dhmp-status">Up to 4 players. No server needed.<br>Everyone has full privileges — harvest, sell, explore freely.</div>
      <div class="dhmp-label">YOUR ROOM CODE (optional — leave blank for random)</div>
      <input class="dhmp-inp" id="dhMpCustomCode" maxlength="16"
        placeholder="e.g. DUSTFARM or leave blank"
        style="text-transform:uppercase;letter-spacing:.1em;"
        value="${localStorage.getItem('dhMpLastCustomCode')||''}">
      <button class="dhmp-btn" onclick="window._dhMpDoHostInGame()">⚑ HOST A GAME</button>
      <hr class="dhmp-hr">
      <div class="dhmp-label">Join a game</div>
      <input class="dhmp-inp" id="dhMpPanelCode" placeholder="Room code">
      <button class="dhmp-btn" onclick="window._dhMpDoJoinInGame()">↳ JOIN</button>
      <hr class="dhmp-hr">
      <button class="dhmp-btn" onclick="window._dhMpToggle()" style="opacity:.5">✕ CLOSE</button>`;
    return;
  }
  if(mp.isHost()&&!mp.peerId){
    mpPanel.innerHTML=`<div class="dhmp-section">🌐 GETTING CODE…</div><div class="dhmp-status">Connecting to PeerJS relay…</div><button class="dhmp-btn danger" onclick="window._dhMpDoDisconnect()">✕ CANCEL</button>`;
    return;
  }
  if(mp.isHost()){
    const gc=mp.guestCount();
    const slots=Object.values(mp.guests).map((g,i)=>`<span style="color:${PLAYER_COLORS[(i+1)%4]}">● ${(g.name||'Partner').slice(0,12)}</span>`).join(' ');
    const empty=Array.from({length:MAX_PLAYERS-1-gc},(_,i)=>`<span style="opacity:.3">○ open</span>`).join(' ');
    mpPanel.innerHTML=`
      <div class="dhmp-section">🌐 HOSTING (${gc}/${MAX_PLAYERS-1} joined)</div>
      <div class="dhmp-label">Room code — click to copy:</div>
      <div class="dhmp-code" onclick="window._dhMpCopyCode()">${displayCode(mp.peerId)}</div>
      <div class="dhmp-players"><span style="color:${PLAYER_COLORS[0]}">⚑ You</span> ${slots} ${empty}</div>
      <button class="dhmp-btn" onclick="window._dhMpToggle()">← CLOSE</button>
      <button class="dhmp-btn danger" onclick="window._dhMpDoDisconnect()">✕ STOP HOSTING</button>`;
    return;
  }
  // Guest
  const others=Object.values(mp.remotePlayers).map((p,i)=>`<span style="color:${PLAYER_COLORS[i%4]}">● ${(p.name||'Partner').slice(0,12)}</span>`).join(' ');
  mpPanel.innerHTML=`
    <div class="dhmp-section">🌐 CO-OP ACTIVE</div>
    <div class="dhmp-players">${others||'<em style="opacity:.5">syncing…</em>'}</div>
    <div class="dhmp-status">Press <b>[T]</b> to chat.<br><span style="font-size:8px;opacity:.7">Everyone shares the farm. Your gold &amp; items are your own.</span></div>
    <button class="dhmp-btn" onclick="window._dhMpToggle()">← CLOSE</button>
    <button class="dhmp-btn danger" onclick="window._dhMpDoDisconnect()">✕ DISCONNECT</button>`;
}