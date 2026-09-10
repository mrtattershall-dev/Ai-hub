function gatherNode(key) {
  const node = resourceNodes[key];
  if (!node || node.depleted) return;
  if (gameState.inMine) return; // mine interior uses gatherMineNode
  if (gameState.zone === 'Farm' || gameState.zone === 'Town' || gameState.zone === 'Ranch') {
    showMsg('⚠️ Gather resources in the Wilderness or Mine!'); return;
  }
  if (player.stamina < node.def.stamina) {
    showMsg('⚠️ Too tired to gather — eat bread or rest.'); return;
  }

  // Tool restriction: stone needs pickaxe, wood needs axe
  const toolCheck = checkToolForNode(node.def);
  if (!toolCheck.ok) { showMsg(toolCheck.msg); return; }

  // If same node timer already running, ignore repeated key presses
  if (actionTimer.active && actionTimer._nodeKey === key) return;
  if (actionTimer.active) cancelAction('');

  // Pre-check weight before committing
  const item = ITEMS[node.def.loot];
  const cap = getEffectiveWeightCap();
  if (item && item.weight > 0 && inventory.totalWeight >= cap) {
    showMsg(`⚠️ Bag too heavy to gather ${item.name}! Sell goods first. [M]`);
    return;
  }

  const toolLabel = node.def.loot === 'stone' ? '⛏ Mining ' + node.def.icon
                  : node.def.loot === 'wood'  ? '🪓 Chopping ' + node.def.icon
                  : '🌿 Gathering ' + node.def.icon;
  const dur = getGatherDuration(node.def.loot);
  actionTimer._nodeKey = key;

  startAction(toolLabel, dur, () => {
    const n2 = resourceNodes[key];
    if (!n2 || n2.depleted) return;

    const gathMult = getEffectiveMiningMult(n2.def.loot);
    const baseQty  = n2.def.qty[0] + Math.floor(Math.random() * (n2.def.qty[1] - n2.def.qty[0] + 1));
    const wantQty  = Math.floor(baseQty * gathMult);
    const capNow   = getEffectiveWeightCap();
    const canFitByWeight = item && item.weight > 0
      ? Math.floor((capNow - inventory.totalWeight) / item.weight)
      : wantQty;
    const tryQty = Math.min(wantQty, canFitByWeight);

    if (tryQty <= 0) { showMsg(`⚠️ No room for ${(item && item.name) || n2.def.loot}! Sell goods first. [M]`); return; }

    const added = addItem(n2.def.loot, tryQty);
    if (added <= 0) return;
    trackNode(n2.def.loot, added);

    player.stamina = Math.max(0, player.stamina - n2.def.stamina);
    n2.depleted = true;
    actionTimer._nodeKey = null;

    if (n2.def.loot === 'stone') {
      setT(n2.x, n2.y, TL.DIRT);
      delete resourceNodes[key];
    } else {
      n2.respawnDay = gameState.day + 2 + Math.floor(Math.random() * 2);
      setT(n2.x, n2.y, n2.def.tile === TL.BUSH ? TL.GRASS : n2.def.tile);
    }

    spawnParticles(n2.x * T + T / 2, n2.y * T + T / 2, '#80c060', 5, n2.def.icon);
    if (added < wantQty) {
      showMsg(`${n2.def.icon} Got ${added}/${wantQty} ${item && item.name} — bag too heavy for the rest!`);
    } else {
      showMsg(`${n2.def.icon} Got ${added}× ${item && item.name}! (-${n2.def.stamina} stamina)`);
    }
    player.actionCooldown = 0.1;
  }, true);
}