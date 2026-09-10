function updateInteractPrompt() {
  const prompt = document.getElementById('interactPrompt');
  if (gameState.inMine) { prompt.style.display='none'; return; }
  if (gameState.inBadlands) {
    const tx2=Math.floor(player.x/T), ty2=Math.floor(player.y/T);
    const nearExit = [[tx2,ty2],[tx2+1,ty2],[tx2-1,ty2],[tx2,ty2+1],[tx2,ty2-1]]
      .some(([cx,cy])=>getBLT(cx,cy)===BL.BL_EXIT);
    if (nearExit) {
      const nearSE = ty2 >= BL_H - 8;
      const portalLabel = nearSE ? '⬅ SE Exit Portal — Return to Frontier' : '⬅ Return to Frontier';
      prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — 🌵 ${portalLabel}`;
      prompt.style.color='#80f0d0'; prompt.style.display='block';
    } else { prompt.style.display='none'; }
    return;
  }
  if (gameState.inHoboCamp) {
    // NPC nearby?
    for (const npc of HC_NPCS) {
      const nx=npc.tx*HC_T+HC_T/2, ny=npc.ty*HC_T+HC_T/2;
      if (Math.hypot(player.x-nx, player.y-ny) < 72) {
        const met = hcTalkSeen.has(npc.id==='hc_railroad'?'dale_met':
                    npc.id==='hc_clerk'?'vera_met':
                    npc.id==='hc_farmer'?'simons_met':
                    npc.id==='hc_doctor'?'lena_met':'kit_met');
        prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — 🏕 Talk to ${npc.name}${met?'':' (new)'}`;
        prompt.style.color='#c8b870'; prompt.style.display='block';
        return;
      }
    }
    // Near south exit?
    if (player.y >= (HC_H-5)*HC_T) {
      prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — ▼ Return to Frontier`;
      prompt.style.color='#a8c85c'; prompt.style.display='block';
      return;
    }
    prompt.style.display='none';
    return;
  }
  // Check for badlands portal BEFORE the Wilderness early-return so it isn't swallowed.
  // The portal tiles at (3,75)–(4,75) fall in the Wilderness zone, which would
  // otherwise hide the prompt before the INTERACT_ZONES loop ever runs.
  {
    const _ptx=Math.floor(player.x/T), _pty=Math.floor(player.y/T);
    const _pchecks=[[_ptx,_pty],[_ptx,_pty+1],[_ptx,_pty-1],[_ptx+1,_pty],[_ptx-1,_pty],[_ptx+2,_pty],[_ptx-2,_pty]];
    if (_pchecks.some(([cx,cy])=>getT(cx,cy)===TL.BADLANDS_PORTAL)) {
      prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — 🏜 Enter The Badlands`;
      prompt.style.color='#e08030'; prompt.style.display='block';
      return;
    }
  }
  if (gameState.zone==='Wilderness') { prompt.style.display='none'; return; }
  // Ocean: boat board/disembark prompt
  if (gameState.inOcean) {
    const ptx=Math.floor(player.x/OC_T), pty=Math.floor(player.y/OC_T);

    // While sailing — show disembark if boat is near shallow/land tiles
    if (player._onBoat && hasBoat()) {
      const tier = getBoatTier();
      // Check if any tile within 3 tiles of boat is land (dock, sand, gangplank)
      const bTx=Math.floor(gameState.boatX/OC_T), bTy=Math.floor(gameState.boatY/OC_T);
      const landTiles=[OC.SAND,OC.DOCK,OC.GANGPLANK,OC.ROAD,OC.FLOOR,OC.GRASS,OC.WATER];
      let nearLand=false;
      for(let dy=-3;dy<=3&&!nearLand;dy++) for(let dx=-3;dx<=3&&!nearLand;dx++) {
        if(landTiles.includes(getOCT(bTx+dx,bTy+dy))) nearLand=true;
      }
      if (nearLand) {
        prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — ⚓ Disembark ${tier.name}`;
        prompt.style.color='#80c8e8'; prompt.style.display='block';
      } else {
        // Show sailing speed
        const spd=Math.round(Math.hypot(gameState.boatVX,gameState.boatVY));
        const tierIdx=BOAT_TIERS.findIndex(b=>b.id===tier.id);
        const maxSpd=[55,75,95,110][Math.min(tierIdx,3)];
        const pct=Math.round(spd/maxSpd*100);
        prompt.innerHTML=`${tier.icon} ${tier.name} &nbsp;·&nbsp; ${pct>0?pct+'% speed':'adrift'}`;
        prompt.style.color='#60a0c8'; prompt.style.display='block';
      }
      return;
    }

    const nearGP=[
      [ptx,pty],[ptx+1,pty],[ptx-1,pty],[ptx,pty+1],[ptx,pty-1],
      [ptx+2,pty],[ptx-2,pty],[ptx,pty+2],[ptx,pty-2]
    ].some(([cx,cy])=>getOCT(cx,cy)===OC.GANGPLANK);

    // Near boat on water (not yet boarded) — wider radius to beat fishing prompt
    const nearBoatOnWater = hasBoat() && !player._onBoat &&
      Math.hypot(player.x-gameState.boatX, player.y-gameState.boatY) < OC_T*5;

    if (nearGP || nearBoatOnWater) {
      if (hasBoat()) {
        const tier=getBoatTier();
        prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — ${tier.icon} Board ${tier.name}`;
        prompt.style.color='#80c8e8';
      } else {
        prompt.innerHTML=`🚢 Gangplank — talk to <b style="color:#f0d060">Maren</b> to buy a vessel`;
        prompt.style.color='#a09060';
      }
      prompt.style.display='block';
      return;
    }
    // Show exit prompt when near west edge
    if (player.x < OC_T*4) {
      prompt.innerHTML=`Press <b style="color:#f0d060">E</b> — ◄ Return to Frontier`;
      prompt.style.color='#a8c85c'; prompt.style.display='block';
      return;
    }
    // Fishing prompt — never show on dock if near gangplank or boat slip
    const nearSlip = hasBoat() &&
      Math.hypot(player.x-gameState.boatX, player.y-gameState.boatY) < OC_T*6;
    if (!nearSlip && countItem('fishingRod')) {
      const onFishable2=[OC.DOCK,OC.GANGPLANK,OC.BOAT_DECK,OC.WATER].includes(getOCT(ptx,pty)) || player._onBoat;
      if (onFishable2) {
        const deepLabel = player._onBoat && getBoatTier() && getBoatTier().deepAccess ? ' (deep water)' : '';
        prompt.innerHTML=`Hold <b style="color:#f0d060">E</b> — 🎣 Cast Fishing Line${deepLabel}`;
        prompt.style.display='block'; return;
      }
    } else if (!nearSlip && !countItem('fishingRod')) {
      const onFishable2=[OC.DOCK,OC.GANGPLANK,OC.WATER].includes(getOCT(ptx,pty)) || player._onBoat;
      if (onFishable2) {
        prompt.innerHTML=`🎣 Fishing — buy a Rod at market Upgrades`;
        prompt.style.color='#8090a0'; prompt.style.display='block'; return;
      }
    }
    prompt.style.display='none'; return;
  }
  const tx = Math.floor(player.x/T), ty = Math.floor(player.y/T);
  if (isNearFishingSpot() && settings.showFishPrompt) {
    if (countItem('fishingRod')) {
      prompt.innerHTML = `Hold <b style="color:#f0d060">E</b> — 🎣 Cast Fishing Line`;
      prompt.style.display = 'block'; return;
    } else {
      prompt.innerHTML = `🎣 Fishing Spot — buy a Rod at market Upgrades`;
      prompt.style.display = 'block'; return;
    }
  }
  const checks = [[tx,ty],[tx,ty+1],[tx,ty-1],[tx+1,ty],[tx-1,ty],[tx+2,ty],[tx-2,ty],[tx,ty+2]];
  for (const [cx,cy] of checks) {
    for (const zone of INTERACT_ZONES) {
      if (zone.check(cx,cy)) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ${zone.icon} ${zone.label}`;
        prompt.style.display = 'block';
        return;
      }
    }
  }
  prompt.style.display = 'none';
}