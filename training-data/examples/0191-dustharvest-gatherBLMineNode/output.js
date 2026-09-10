function gatherBLMineNode(key) {
  const fl = gameState.blMineFloor;
  const nodes = blMineResourceNodes[fl];
  const node = nodes[key];
  if (!node || node.depleted) return;
  // Stamina check
  if (player.stamina < node.def.stamina) {
    showMsg('⚠️ Too tired to mine — eat or rest.'); return;
  }
  // Tool check
  const toolCheck = checkToolForNode(node.def);
  if (!toolCheck.ok) { showMsg(toolCheck.msg); return; }
  // Weight check
  const item = ITEMS[node.def.loot];
  if (item && item.weight > 0 && inventory.totalWeight >= getEffectiveWeightCap()) {
    showMsg('⚠️ Bag full! Sell goods first.'); return;
  }
  // Already in progress on this node?
  if (actionTimer.active && actionTimer._nodeKey === key) return;
  if (actionTimer.active) cancelAction('');
  // Hold-E action timer — same pattern as overworld mine
  const dur = getGatherDuration(node.def.loot) * 0.9;
  const richDetect = player._pickDiamond && Math.random() < 0.18;
  actionTimer._nodeKey = key;
  startAction(`⛏ Mining ${node.def.icon}${richDetect ? ' ✨ Rich!' : ''}`, dur, () => {
    const n2 = blMineResourceNodes[fl][key];
    if (!n2 || n2.depleted) return;
    n2.depleted = true;
    n2.respawnDay = gameState.day + 2 + fl;
    const gathMult = getEffectiveMiningMult(n2.def.loot);
    const [minQ, maxQ] = n2.def.qty;
    const baseQty = Math.round((minQ + Math.floor(Math.random()*(maxQ-minQ+1))) * gathMult);
    const quality = rollOreQuality(fl + 1); // BL mine is slightly richer
    // Canary bonus — same as overworld
    const canaryBonus = player._mineCanary && fl >= 2 ? 1 : 0;
    const tryQty = baseQty + canaryBonus + (richDetect ? 2 : 0);
    const added = addItem(n2.def.loot, tryQty, quality);
    if (added <= 0) { showMsg('⚠️ Bag full.'); return; }
    trackOre(n2.def.loot, added);
    gainRep('badlands', added);
    gainRep('mine', added); // company mine ore feeds mine rep too
    player.stamina = Math.max(0, player.stamina - n2.def.stamina);
    spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#80a0c0', 5, n2.def.icon);
    const ql = oreQualityLabel(quality);
    showMsg(`${n2.def.icon} ${added}× ${ITEMS[n2.def.loot]?.name||n2.def.loot}${ql?' '+ql:''} — company vein.`);
    setBLMineT(fl, n2.x, n2.y, TL.MINE_FLOOR);
  });
}