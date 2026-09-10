function updateGatherPrompt() {
  const prompt = document.getElementById('gatherPrompt');
  if (gameState.inBadlands) {
    // Outpost features proximity prompt (takes priority over gathering)
    const blFeatureList = [
      { x:blFireX, y:blFireY, label:'Rest at campfire (🔥 +40HP, +50ST)' },
      { x:blChestX, y:blChestY, label: blChestLooted ? 'Chest (looted)' : '📦 Loot outpost chest' },
      { x:blWantedBoardX, y:blWantedBoardY, label:'📋 Wanted Board — bounties' },
      { x:blRailSignX, y:blRailSignY, label:'📌 Weathered sign (deep west)' },
      { x:blVendorX, y:blVendorY, label: blTalkSeen.has('who_are_you') ? 'Crane — talk / sell' : 'Stranger — talk / sell' },
      { x:blDeepChestX, y:blDeepChestY, label: blDeepChestLooted ? '💀 Settlement chest (looted)' : '💀 Loot settlement chest' },
      { x:blMineEntranceX, y:blMineEntranceY, label:'⛏ Company Mine — 5 levels (near settlement ruins)' },
      { x:blDeepChestX+2, y:blDeepChestY+3, label:'👥 Stranger in the ruins' },
    ];
    for (const f of blFeatureList) {
      if (Math.hypot(player.x-(f.x*T+T/2), player.y-(f.y*T+T/2)) < T*2.5) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ${f.label}`;
        prompt.style.color='#c0d080'; prompt.style.display='block'; return;
      }
    }
    const nearby = getNearbyBLNode();
    if (nearby) {
      const node = badlandsNodes[nearby];
      const def  = node ? node.def : null;
      if (def) {
        const toolCheck = checkToolForNode(def);
        if (!toolCheck.ok) {
          const hint = def.loot === 'stoneShard' || def.loot === 'copperOre' || def.loot === 'ironOre' || def.loot === 'silverOre' || def.loot === 'obsidian' ? '⛏ Pickaxe required' : '🪓 Axe required';
          prompt.innerHTML = `${def.icon} ${hint} — upgrade in market`;
          prompt.style.color='#e07040'; prompt.style.display='block'; return;
        }
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ${def.label} ${def.icon} (${def.stamina} stamina)`;
        prompt.style.color='#e09040'; prompt.style.display='block'; return;
      }
    }
    const nearEnemy = badlandsEnemies.find(e => Math.hypot(player.x-e.x, player.y-e.y)<60);
    if (nearEnemy) {
      prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ⚔️ Attack ${BADLANDS_ENEMY_DEFS[nearEnemy.type]?.name||'enemy'}`;
      prompt.style.color='#e04020'; prompt.style.display='block'; return;
    }
    prompt.style.display='none'; return;
  }
  if (gameState.inMine) {
    // Mine interior: show shaft/exit prompts or gather prompt
    const fl = gameState.mineFloor;
    const ptx = Math.floor(player.x/T), pty = Math.floor(player.y/T);
    const mineChecks = [[ptx,pty],[ptx,pty+1],[ptx,pty-1],[ptx+1,pty],[ptx-1,pty]];
    for (const [cx2,cy2] of mineChecks) {
      const mt = getMineT(fl, cx2, cy2);
      if (mt === TL.MINE_EXIT) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — 🚪 Exit Mine (return to surface)`;
        prompt.style.color='#80e880'; prompt.style.display='block'; return;
      }
      if (mt === TL.MINE_SHAFT_DOWN) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ⬇️ Descend to Floor ${fl+2}`;
        prompt.style.color='#c080e8'; prompt.style.display='block'; return;
      }
      if (mt === TL.MINE_SHAFT_UP) {
        prompt.innerHTML = fl === 0
          ? `Press <b style="color:#f0d060">E</b> — ⬆️ Exit to surface`
          : `Press <b style="color:#f0d060">E</b> — ⬆️ Ascend to Floor ${fl}`;
        prompt.style.color='#80b8e8'; prompt.style.display='block'; return;
      }
    }
    // Cart prompt — shown when player is near a rail point
    if (player._mineCart) {
      const _cp = getNearbyCartPoint();
      if (_cp) {
        prompt.innerHTML = 'Press <b style="color:#f0d060">F</b> — 🛒 Cart to ' + _cp.label;
        prompt.style.color = '#c0a040'; prompt.style.display = 'block'; return;
      }
    }
    const nearby = getMineNearbyNode();
    if (nearby) {
      const def = nearby.node.def;
      const mult = getEffectiveMiningMult(def.loot);
      const multStr = mult > 1 ? ` <span style="color:#80e060">×${mult}</span>` : '';
      const toolCheck = checkToolForNode(def);
      if (!toolCheck.ok) {
        prompt.innerHTML = `${def.icon} Pickaxe required — buy at market Upgrades`;
        prompt.style.color='#e07040'; prompt.style.display='block'; return;
      }
      const dur = (getGatherDuration(def.loot)*0.9).toFixed(1);
      prompt.innerHTML = `Hold <b style="color:#f0d060">E</b> — ${def.label} ${def.icon}${multStr} (${dur}s)`;
      prompt.style.color=''; prompt.style.display='block'; return;
    }
    prompt.style.display='none'; return;
  }
  if (gameState.inBLMine) {
    // BL Mine interior: shaft/exit prompts + gather prompt
    const fl = gameState.blMineFloor;
    const ptx = Math.floor(player.x/T), pty = Math.floor(player.y/T);
    for (const [cx2,cy2] of [[ptx,pty],[ptx,pty+1],[ptx,pty-1],[ptx+1,pty],[ptx-1,pty]]) {
      const mt = getBLMineT(fl, cx2, cy2);
      if (mt === TL.MINE_EXIT || mt === TL.MINE_SHAFT_UP) {
        const lbl = fl === 0 ? 'Exit to badlands' : `Ascend to Level ${fl}`;
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ⬆️ ${lbl}`;
        prompt.style.color='#80b8e8'; prompt.style.display='block'; return;
      }
      if (mt === TL.MINE_SHAFT_DOWN) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — ⬇️ Descend to Level ${fl+2}`;
        prompt.style.color='#c080e8'; prompt.style.display='block'; return;
      }
    }
    // NPC prompt
    for (const npc of BL_MINE_NPCS) {
      if (npc.floor !== fl) continue;
      if (Math.hypot(player.x-(npc.tx*T+T/2), player.y-(npc.ty*T+T/2)) < T*2.5) {
        prompt.innerHTML = `Press <b style="color:#f0d060">E</b> — 💬 Talk to ${npc.name}`;
        prompt.style.color='#c0a060'; prompt.style.display='block'; return;
      }
    }
    // Vein gather prompt
    const blNearby = getBLMineNearbyNode();
    if (blNearby) {
      const def = blNearby.node.def;
      const toolCheck = checkToolForNode(def);
      if (!toolCheck.ok) {
        prompt.innerHTML = `${def.icon} Pickaxe required — buy at market Upgrades`;
        prompt.style.color='#e07040'; prompt.style.display='block'; return;
      }
      const dur = (getGatherDuration(def.loot)*0.9).toFixed(1);
      prompt.innerHTML = `Hold <b style="color:#f0d060">E</b> — ${def.label} ${def.icon} (${dur}s)`;
      prompt.style.color=''; prompt.style.display='block'; return;
    }
    prompt.style.display='none'; return;
  }
  if (gameState.zone==='Wilderness' || gameState.zone==='Mine') {
    const nearby = getNearbyNode();
    if (nearby) {
      const def = nearby.node.def;
      const mult = getEffectiveMiningMult(def.loot);
      const multStr = mult > 1 ? ` <span style="color:#80e060">×${mult}</span>` : '';
      const toolCheck = checkToolForNode(def);
      if (!toolCheck.ok) {
        // Show tool-required hint
        const hint = def.loot === 'stone' ? '⛏ Pickaxe required' : '🪓 Axe required';
        prompt.innerHTML = `${def.icon} ${hint} — buy at market Upgrades`;
        prompt.style.color = '#e07040';
        prompt.style.display = 'block';
        return;
      }
      prompt.style.color = '';
      const dur = getGatherDuration(def.loot).toFixed(1);
      prompt.innerHTML = `Hold <b style="color:#f0d060">E</b> — ${def.label} ${def.icon}${multStr} (${dur}s)`;
      prompt.style.display='block';
      return;
    }
  }
  prompt.style.display='none';
}