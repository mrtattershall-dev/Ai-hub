function _reelCatch() {
  const catch_ = _fish.pendingCatch;
  const baitId = _fish.baitId;
  _fish.pendingCatch = null;
  _fish.phase = 'idle';
  _fish.baitId = null;
  cancelAction('');

  if (!catch_) { showMsg('🎣 Nothing on the line.'); return; }
  const item = ITEMS[catch_.id];
  if (!item) { showMsg('🎣 Something got away.'); return; }
  if (inventory.totalWeight + (item.weight||1) > getEffectiveWeightCap()) {
    showMsg('⚠️ Bag too heavy — drop something first!'); return;
  }

  // Consume bait now that catch is confirmed
  consumeBait(baitId);

  // Check first catch BEFORE incrementing
  const prevCount = stats.fishCaught[catch_.id] || 0;
  const isFirst = prevCount === 0;

  addItem(catch_.id, 1);
  trackFish(catch_.id); // handles all stat increments
  player.stamina = Math.max(0, player.stamina - 5);

  const price = economy.prices[catch_.id] || BASE_PRICES[catch_.id] || 0;

  if (catch_.id === 'junkBoot' || catch_.id === 'rustNail') {
    showMsg(`🎣 Pulled out a ${catch_.label}… You keep it anyway.`);
  } else if (catch_.id === 'deedFragment') {
    spawnParticles(player.x, player.y, '#c8b870', 8, '📜');
    showMsg(`🎣 📜 A DEED FRAGMENT — partial survey coordinates. Vera at the Hobo Camp will want to see this.`);
  } else if (catch_.id === 'surveyorCompass') {
    spawnParticles(player.x, player.y, '#80a0c0', 6, '🧭');
    showMsg(`🎣 🧭 SURVEYOR'S COMPASS — Altaverde Holdings engraved on the back. Show it to Vera at the Hobo Camp.`);
  } else if (catch_.id === 'oldFlask') {
    spawnParticles(player.x, player.y, '#80d080', 4, '🧪');
    showMsg(`🎣 An old sealed flask from the creek mud. Dr. Lena at the Hobo Camp will know what was in it.`);
  } else if (catch_.id === 'snapperTurtle') {
    spawnParticles(player.x, player.y, '#608040', 5, '🐢');
    showMsg(`🎣 🐢 Snapper Turtle — tough catch. Worth $${BASE_PRICES.snapperTurtle}.`);
  } else if (catch_.id === 'goldenfish') {
    spawnParticles(player.x, player.y, '#f0d060', 10, '✨');
    showMsg(`🎣 ✨ GOLDEN FISH — you barely believe it. Worth $${price}.`);
  } else if (isFirst) {
    spawnParticles(player.x, player.y, '#80d8ff', 4, '🎣');
    showMsg(`🎣 First ${item.name}! Added to your logbook. Worth ~$${price}.`);
  } else {
    showMsg(`🎣 ${catch_.label}. Worth ~$${price}.`);
  }
  player.actionCooldown = 0.3;
}