function gatherMineNode(key) {
  const fl = gameState.mineFloor;
  const node = mineResourceNodes[fl][key];
  if (!node || node.depleted) return;
  if (player.stamina < node.def.stamina) {
    showMsg('⚠️ Too tired to mine — eat bread or rest.'); return;
  }
  const toolCheck = checkToolForNode(node.def);
  if (!toolCheck.ok) { showMsg(toolCheck.msg); return; }
  if (actionTimer.active && actionTimer._nodeKey === key) return;
  if (actionTimer.active) cancelAction('');
  const item = ITEMS[node.def.loot];
  const cap = getEffectiveWeightCap();
  if (item && item.weight > 0 && inventory.totalWeight >= cap) {
    showMsg(`⚠️ Bag too heavy to mine ${item.name}! Sell goods first. [M]`); return;
  }
  const dur = getGatherDuration(node.def.loot) * 0.9; // slight speed bonus in mine
  const richDetect = player._pickDiamond && Math.random() < 0.18; // diamond pick reveals rich veins
  actionTimer._nodeKey = key;
  startAction(`⛏ Mining ${node.def.icon}${richDetect ? ' ✨ Rich!' : ''}`, dur, () => {
    const n2 = mineResourceNodes[fl][key];
    if (!n2 || n2.depleted) return;
    const gathMult = getEffectiveMiningMult(n2.def.loot);
    const baseQty = n2.def.qty[0] + Math.floor(Math.random() * (n2.def.qty[1] - n2.def.qty[0] + 1));
    const wantQty = Math.floor(baseQty * gathMult);
    const canFit = item && item.weight > 0 ? Math.floor((getEffectiveWeightCap()-inventory.totalWeight)/item.weight) : wantQty;
    const tryQty = Math.min(wantQty, canFit);
    if (tryQty <= 0) { showMsg(`⚠️ No room for ${item&&item.name}! Sell first. [M]`); return; }

    // Roll ore quality
    const quality = rollOreQuality(fl);

    // Deplete node — stamina is deducted AFTER the branch resolves so hollow/
    // collapse outcomes don't silently eat stamina with no reward. Store the
    // cost on the node snapshot so resolveBranch can apply it at the right time.
    stats.floorsReached[fl] = true;
    const _staminaCost = n2.def.stamina;
    n2.depleted = true;
    n2.respawnDay = gameState.day + 3 + Math.floor(Math.random() * 3);
    setMineT(fl, n2.x, n2.y, TL.MINE_FLOOR);

    // Hidden shaft — if this singing vein conceals the path to floor 4, reveal it
    if (n2.hiddenShaft && fl === 2) {
      // Guard: only set the shaft tile if the cell hasn't already been changed
      // (prevents double-fire on rapid inputs within the 600ms window)
      const _shaftX = n2.x, _shaftY = n2.y;
      setTimeout(() => {
        if (getMineT(fl, _shaftX, _shaftY) === TL.MINE_FLOOR) {
          setMineT(fl, _shaftX, _shaftY, TL.MINE_SHAFT_DOWN);
          spawnParticles(_shaftX*T+T/2, _shaftY*T+T/2, '#6040c0', 12, '🕳️');
          showMsg('🪬 The stone breaks away. A shaft drops into darkness below. The air coming up from it is cold in a way that has nothing to do with temperature.');
          if (minerTalkSeen && !minerTalkSeen.has('floor4_found')) {
            minerTalkSeen.add('floor4_found');
          }
        }
      }, 600);
    }
    actionTimer._nodeKey = null;

    // Coal session tracking for blue coal unlock.
    // Only increment on coal; do NOT reset on other ore types — the streak
    // should only break when the player leaves the mine (handled in exitMine).
    if (n2.def.loot === 'coal') {
      gameState._mineCoalSessions = (gameState._mineCoalSessions || 0) + 1;
      if (gameState._mineCoalSessions >= 3 && Math.random() < 0.30 && quality !== 'flawed') {
        addItem('blueCoal', 1);
        appendMineJournal(`Day ${gameState.day} — The coal burns blue sometimes. Strange.`);
        showMsg('🔵 Blue coal! This batch burns with an eerie blue flame. Something is different here.');
        spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#4060e0', 6, '🔵');
      }
    }

    // ── VEIN BRANCHING ──────────────────────────────────────────────
    // Every non-trivial vein triggers a branch choice (singing vein excluded).
    // Stamina is passed through so each branch outcome can deduct it itself.
    const isBranchable = n2.def.tile !== TL.SINGING_VEIN;
    if (isBranchable) {
      spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#a0a0c0', 3, '💥');
      // Small delay so the mining animation lands before the panel pops
      setTimeout(() => {
        showVeinBranchPrompt(n2, key, fl, tryQty, quality, _staminaCost);
      }, 200);
    } else {
      // Singing vein — no branch, just give the ore directly and pay stamina now
      player.stamina = Math.max(0, player.stamina - _staminaCost);
      const added = addItem(n2.def.loot, tryQty);
      if (added <= 0) return;
      trackOre(n2.def.loot, added);
      gainRep('mine', added); // +1 rep per ore mined
      spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#80c0e8', 5, n2.def.icon);
      if (added < wantQty) {
        showMsg(`${n2.def.icon} Got ${added}/${wantQty} ${item&&item.name} — bag full!`);
      } else {
        showMsg(`${n2.def.icon} Got ${added}× ${item&&item.name}! (-${_staminaCost} stamina)`);
      }
    }

    // Diamond pickaxe rich-vein bonus — 1-2 extra ore (on top of branch).
    // Only fires if the bag can actually hold the items.
    if (richDetect) {
      const bonusQty = 1 + Math.floor(Math.random() * 2);
      const bonusAdded = addItem(n2.def.loot, bonusQty, quality);
      if (bonusAdded > 0) {
        spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#f0d060', 5, '✨');
        showMsg(`✨ Diamond pick reveals rich vein! Bonus ${bonusAdded}× ${item&&item.name}!`);
      }
    }
    player.actionCooldown = 0.1;
  }, true);
}