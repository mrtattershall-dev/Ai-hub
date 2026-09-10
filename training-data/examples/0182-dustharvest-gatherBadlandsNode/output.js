function gatherBadlandsNode(key) {
  const node=badlandsNodes[key];
  if(!node||node.depleted) return;
  const def=node.def;
  if(player.stamina < def.stamina) { showMsg(`⚠️ Not enough stamina to ${def.label.toLowerCase()}.`); return; }

  // Tool restriction — same as wilderness: ore needs pickaxe, wood needs axe
  const toolCheck = checkToolForNode(def);
  if (!toolCheck.ok) { showMsg(toolCheck.msg); return; }

  // Weight pre-check
  const item = ITEMS[def.loot];
  if (item && item.weight > 0 && inventory.totalWeight >= getEffectiveWeightCap()) {
    showMsg(`⚠️ Bag too heavy to gather ${item.name}! Sell goods first [M].`); return;
  }

  // Deduplicate: ignore repeated presses while same node timer is running
  if (actionTimer.active && actionTimer._nodeKey === 'bl_'+key) return;
  if (actionTimer.active) cancelAction('');

  // Duration scales with stamina cost — heavy nodes take longer
  const dur = Math.max(0.4, (def.stamina / 5) * 0.55);
  const toolLabel = def.stamina >= 14 ? `⛏ ${def.label}…`
                  : def.stamina >= 8  ? `🪓 ${def.label}…`
                  : `🌿 ${def.label}…`;
  actionTimer._nodeKey = 'bl_'+key;

  startAction(toolLabel, dur, () => {
    // Re-validate after timer
    const n2 = badlandsNodes[key];
    if (!n2 || n2.depleted) { showMsg('Already gathered.'); return; }
    if (player.stamina < def.stamina) { showMsg(`⚠️ Too tired to ${def.label.toLowerCase()}.`); return; }
    const qty = def.qty[0]+Math.floor(Math.random()*(def.qty[1]-def.qty[0]+1));
    const added = addItem(def.loot, qty);
    if (added <= 0) { showMsg(`⚠️ Bag full — can't carry ${item?.name||def.loot}!`); return; }
    player.stamina = Math.max(0, player.stamina - def.stamina);
    spawnParticles(n2.x*T+T/2, n2.y*T+T/2, '#d4b870', 4, def.icon);
    showMsg(`${def.icon} Got ${added}× ${ITEMS[def.loot]?.name||def.loot}`);
    n2.depleted = true;
    n2.respawnDay = gameState.day+3;
    setBLT(n2.x, n2.y, BL.CRACKED);
    actionTimer._nodeKey = null;
    player.actionCooldown = 0.2;
  });
}