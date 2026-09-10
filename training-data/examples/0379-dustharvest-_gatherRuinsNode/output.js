function _gatherRuinsNode(key) {
  const node = JG_RUINS_NODES[key];
  if (!node || node.depleted) return false;
  if (actionTimer.active && actionTimer._nodeKey === key + '_ruins') return true;
  if (actionTimer.active) cancelAction('');
  actionTimer._nodeKey = key + '_ruins';
  startAction('⚙ Salvaging equipment…', 1.4, () => {
    const n2 = JG_RUINS_NODES[key];
    if (!n2 || n2.depleted) { actionTimer._nodeKey = null; return; }
    const qty = n2.qty[0] + Math.floor(Math.random() * (n2.qty[1] - n2.qty[0] + 1));
    const added = addItem(n2.loot, qty);
    n2.depleted = true;
    n2.respawnDay = gameState.day + 5 + Math.floor(Math.random() * 4);
    player.stamina = Math.max(0, player.stamina - 6);
    spawnParticles(n2.tx * JG_T + JG_T / 2, n2.ty * JG_T + JG_T / 2, '#808090', 5, '⚙');
    gainRep('jungle', 1);
    showMsg(`⚙ Salvaged ${added || qty}× ${ITEMS[n2.loot].name}. Tobias can move this.`);
    raiseCompliance('ruinsEntry');
    player.actionCooldown = 0.1;
    actionTimer._nodeKey = null;
  }, true);
  return true;
}