function gatherJGNode(key) {
  const node = jgResourceNodes[key];
  if (!node || node.depleted) return false;

  // Axe check for wood
  if (node.def.needsAxe && !hasAxe()) {
    showMsg('🪓 You need an Axe to chop jungle wood — buy one at the market [M] → Upgrades.');
    return true;
  }
  if (player.stamina < node.def.stamina) {
    showMsg('⚠️ Too tired to gather — eat something first.');
    return true;
  }
  if (inventory.totalWeight >= getEffectiveWeightCap()) {
    showMsg(`⚠️ Bag too heavy to gather ${node.def.icon} — sell goods via Tobias first.`);
    return true;
  }
  if (actionTimer.active && actionTimer._nodeKey === key + '_jg') return true;
  if (actionTimer.active) cancelAction('');

  actionTimer._nodeKey = key + '_jg';
  const dur = node.def.loot === 'jgWood' ? Math.max(0.4, (player._woodCd || 1.0) * 1.8)
            : node.def.loot === 'jgHerb' || node.def.loot === 'jgMushroom' ? 0.7
            : 1.0;

  startAction(`${node.def.icon} ${node.def.label}…`, dur, () => {
    const n2 = jgResourceNodes[key];
    if (!n2 || n2.depleted) { actionTimer._nodeKey = null; return; }

    const gathMult = getEffectiveMiningMult(n2.def.loot);
    const baseQty  = n2.def.qty[0] + Math.floor(Math.random() * (n2.def.qty[1] - n2.def.qty[0] + 1));
    const qty = Math.floor(baseQty * gathMult);
    const added = addItem(n2.def.loot, qty);

    player.stamina = Math.max(0, player.stamina - n2.def.stamina);
    n2.depleted = true;
    n2.respawnDay = gameState.day + 3 + Math.floor(Math.random() * 3);

    // Tile reverts to base
    setJGT(n2.x, n2.y, JG.GRASS); // cleared tile becomes walkable floor

    spawnParticles(n2.x * JG_T + JG_T / 2, n2.y * JG_T + JG_T / 2, '#60c040', 5, n2.def.icon);
    gainRep('jungle', 1);
    trackNode(n2.def.loot, added || qty);
    showMsg(`${n2.def.icon} Got ${added || qty}× ${ITEMS[n2.def.loot]?.name}! Sell via Tobias for eastern premium.`);
    player.actionCooldown = 0.1;
    actionTimer._nodeKey = null;
  }, true);
  return true;
}