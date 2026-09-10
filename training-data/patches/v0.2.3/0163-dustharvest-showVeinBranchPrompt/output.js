function showVeinBranchPrompt(node, key, fl, baseQty, quality, staminaCost) {
  const outcome = rollBranchOutcome(fl);
  // Check deep map: reveals hollow/collapse before choice
  const deepMapKey = `${fl}_${gameState.day}`;
  const deepMapReveals = player._deepMap && !gameState._deepMapUsed[deepMapKey] &&
    (outcome === 'hollow' || outcome === 'collapse');
  if (deepMapReveals) {
    gameState._deepMapUsed[deepMapKey] = true;
    showMsg(`🗺️ Deep Map: the right seam is hollow. The map marks it clearly.`);
  }
  const leftHint  = branchHintText(outcome, true);
  const rightHint = branchHintText(outcome === 'hollow' ? 'safe' : 'hollow', false);
  // Decoy side is always 'safe'
  const leftIsReal = Math.random() < 0.5;
  const realHint  = leftIsReal ? leftHint  : rightHint;
  const decoyHint = leftIsReal ? rightHint : leftHint;
  const desc = `The vein cracked — two seams exposed.\n\nLeft ${leftIsReal ? realHint : decoyHint}.\nRight ${leftIsReal ? decoyHint : realHint}.`;
  const resolveBranch = (chooseReal) => {
    closeEncounter();
    // Pay stamina here — after the choice, so hollow/collapse outcomes cost
    // the base swing only, and the rich-vein path adds its own extra on top.
    player.stamina = Math.max(0, player.stamina - staminaCost);
    if (chooseReal) {
      resolveBranchOutcome(outcome, node, key, fl, baseQty, quality);
    } else {
      // Chose decoy — always safe but reduced
      const safeQty = Math.max(1, Math.floor(baseQty * 0.6));
      addItem(node.def.loot, safeQty, quality);
      trackOre(node.def.loot, safeQty);
      gainRep('mine', safeQty); // +1 rep per ore mined
      appendMineJournal(`Day ${gameState.day} — Took the safer branch. Got ${safeQty}× ${ITEMS[node.def.loot]?.name || node.def.loot}.`);
      showMsg(`${node.def.icon} Cautious choice — ${safeQty}× ${ITEMS[node.def.loot]?.name}. Solid, if unspectacular.`);
    }
    spawnParticles(node.x*T+T/2, node.y*T+T/2, '#80c0e8', 4, node.def.icon);
  };
  // Show encounter panel repurposed for branch choice
  const enc = {
    icon: '⛏', title: 'VEIN CRACKED — CHOOSE A SEAM',
    desc,
    options: [
      { label: `← Left seam`, cls: 'safe',
        action: () => resolveBranch(leftIsReal) },
      { label: `Right seam →`, cls: '',
        action: () => resolveBranch(!leftIsReal) },
    ]
  };
  showEncounterPanel(enc);
}