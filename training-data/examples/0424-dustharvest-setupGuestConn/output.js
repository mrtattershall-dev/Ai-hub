function setupGuestConn(conn) {
  const gid = conn.peer;
  mp.guests[gid] = { conn, name: 'Partner', pos: null };

  conn.on('open', () => {
    mp.partnerReady = true;
    startTimers();
    // Send current world immediately
    setTimeout(() => {
      const ws = buildWorldState();
      ws.type = 'world_state';
      mp.sendTo(gid, ws);
    }, 200);
    showMsg(`🌐 Partner joined! (${mp.guestCount()} guest${mp.guestCount()>1?'s':''})`);
    updateBadge(); renderPanel();
  });

  conn.on('data', msg => {
    // Update name from pos
    if (msg.type === 'pos' && msg._pid) {
      if (mp.guests[gid]) mp.guests[gid].name = msg.name || 'Partner';
      mp.remotePlayers[gid] = msg;
      // Relay to all other guests
      for (const [ogid, g] of Object.entries(mp.guests)) {
        if (ogid !== gid && g.conn?.open) try { g.conn.send(msg); } catch(_){}
      }
      return;
    }
    if (msg.type === 'plot_patch') {
      applyPlotPatch(msg.patches);
      // Relay to other guests
      for (const [ogid, g] of Object.entries(mp.guests)) {
        if (ogid !== gid && g.conn?.open) try { g.conn.send(msg); } catch(_){}
      }
      return;
    }
    if (msg.type === 'tile_patch') {
      applyTilePatch(msg);
      // Relay to other guests
      for (const [ogid, g] of Object.entries(mp.guests)) {
        if (ogid !== gid && g.conn?.open) try { g.conn.send(msg); } catch(_){}
      }
      return;
    }
    if (msg.type === 'chat') {
      const text = (msg.text||'').slice(0,120);
      showMsg(`💬 ${msg.senderName||'Partner'}: ${text}`, 4000);
      // Relay to other guests
      for (const [ogid, g] of Object.entries(mp.guests)) {
        if (ogid !== gid && g.conn?.open) try { g.conn.send(msg); } catch(_){}
      }
      return;
    }
    // Shared farm state — apply locally and relay to other guests
    if (msg.type === 'chest_update')   { applyChestUpdate(msg);   }
    if (msg.type === 'debt_update')    { applyDebtUpdate(msg);    }
    if (msg.type === 'upgrades_update'){ applyUpgradesUpdate(msg); }
    if (msg.type === 'chest_update' || msg.type === 'debt_update' || msg.type === 'upgrades_update') {
      for (const [ogid, g] of Object.entries(mp.guests)) {
        if (ogid !== gid && g.conn?.open) try { g.conn.send(msg); } catch(_){}
      }
      return;
    }
    if (msg.type === 'sync_request') {
      // Guest completed a contract/quest — send fresh world state immediately
      setTimeout(() => { const ws=buildWorldState(); ws.type='world_state'; mp.sendTo(gid, ws); }, 100);
      return;
    }
  });

  conn.on('close', () => {
    const name = mp.guests[gid]?.name || 'A player';
    delete mp.guests[gid];
    delete mp.remotePlayers[gid];
    delete _remoteRenderPos[gid];
    mp.partnerReady = mp.guestCount() > 0;
    if (!mp.partnerReady) stopTimers();
    mp.broadcast({ type:'player_left', id:gid, name });
    showMsg(`🌐 ${name} left.`);
    updateBadge(); renderPanel();
  });

  conn.on('error', ()=>{});
}