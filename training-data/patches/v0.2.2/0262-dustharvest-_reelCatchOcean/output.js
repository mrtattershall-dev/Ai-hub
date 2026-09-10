function _reelCatchOcean() {
  const catch_ = _fish.pendingCatch;
  const isNight = _fish._oceanIsNight;
  const jellyfish = _fish._oceanJellyfish;
  _fish.pendingCatch = null;
  _fish.phase = 'idle';
  cancelAction('');

  if (jellyfish) {
    showMsg('🎣 🪼 Bioluminescent jellyfish drifted past the line. You don\'t take it. Some things are better left in the water.');
    gainRep('ocean', 1);
    return;
  }
  if (!catch_) { showMsg('🎣 Nothing on the line.'); return; }

  if (catch_.id === 'leatherbackTurtle') {
    spawnParticles(player.x, player.y, '#80c860', 6, '🐢');
    showMsg('🎣 🐢 LEATHERBACK — massive, ancient. You let it go. The line went slack and something felt right about that.');
    gainRep('ocean', 3);
    player.stamina = Math.max(0, player.stamina - 5);
    return;
  }

  const item = ITEMS[catch_.id];
  if (!item) { showMsg('🎣 Something got away.'); return; }
  if (inventory.totalWeight + (item.weight||1) > getEffectiveWeightCap()) {
    showMsg('⚠️ Bag too heavy for the catch.'); return;
  }

  const prevCount = stats.fishCaught[catch_.id] || 0;
  const isFirst = prevCount === 0;
  addItem(catch_.id, 1);
  trackFish && trackFish(catch_.id);
  player.stamina = Math.max(0, player.stamina - 5);
  gainRep('ocean', 1);

  const price = economy.prices[catch_.id] || BASE_PRICES[catch_.id] || 0;
  // Special items fire their dedicated message regardless of isFirst (same priority as river fishing).
  // isFirst fallback is at the bottom so it applies only to ordinary fish caught for the first time.
  if (catch_.id === 'navalChart') {
    spawnParticles(player.x, player.y, '#80d8ff', 6, '🗺');
    showMsg('🎣 🗺 NAVAL CHART — eastern island routes, partially readable. Maren might recognize the markings.');
  } else if (catch_.id === 'shipsLog') {
    spawnParticles(player.x, player.y, '#c8b870', 6, '📖');
    showMsg('🎣 📖 SHIP\'S LOG — Altaverde cargo manifest. Last entry three years ago. The route stops mid-sentence.');
  } else if (catch_.id === 'ghostLantern') {
    spawnParticles(player.x, player.y, '#f0c840', 8, '🏮');
    showMsg('🎣 🏮 GHOST LANTERN — sealed brass, still warm. No wick, no oil. No explanation.');
  } else if (catch_.id === 'deepseaPearl') {
    spawnParticles(player.x, player.y, '#c0a0ff', 10, '💎');
    showMsg(`🎣 💎 DEEPWATER PEARL — black, perfect. Worth $${price}. The sea keeps most of what it has.`);
  } else if (catch_.id === 'kraken') {
    spawnParticles(player.x, player.y, '#4040a0', 8, '🦑');
    showMsg('🎣 🦑 KRAKEN INK SAC — deep black. You\'re not sure how it ended up on your line.');
  } else if (catch_.id === 'goldenDrum') {
    spawnParticles(player.x, player.y, '#f0d060', 8, '✨');
    showMsg(`🎣 ✨ GOLDEN DRUM — color variant. Collectors pay $${price} for one of these.`);
  } else if (catch_.id === 'swordfish') {
    spawnParticles(player.x, player.y, '#60c8ff', 8, '⚔');
    showMsg('🎣 SWORDFISH — took ten minutes to bring in. Worth every second.');
  } else if (catch_.id === 'bluefinTuna') {
    spawnParticles(player.x, player.y, '#4080d0', 8, '🐠');
    showMsg(`🎣 BLUEFIN TUNA — $${price} at market. City buyers want these fresh.`);
  } else if (catch_.id === 'giantGrouper') {
    spawnParticles(player.x, player.y, '#a06030', 6, '🐟');
    showMsg(`🎣 GIANT GROUPER — a hundred pounds on the line. $${price}.`);
  } else if (catch_.id === 'anchorBolt') {
    showMsg('🎣 Old anchor bolt. Altaverde stamp on one end. Someone was here before the dock.');
  } else if (catch_.id === 'junkBoot') {
    showMsg('🎣 Waterlogged boot. The sea gives what the sea has.');
  } else if (catch_.id === 'netScraps') {
    showMsg('🎣 Net scraps. Not nothing — some salvageable rope.');
  } else if (catch_.id === 'barnacledBottle') {
    showMsg('🎣 A sealed bottle. Something\'s inside. Could be nothing.');
  } else if (catch_.id === 'shipTimber') {
    showMsg(`🎣 Ship timber — dense hardwood from a wreck. Worth $${price}.`);
  } else if (catch_.id === 'corrodedFlask') {
    showMsg('🎣 Deep-corroded flask. Whatever was in it left a stain.');
  } else if (isFirst) {
    // First catch of any ordinary fish — logbook notification
    spawnParticles(player.x, player.y, '#80d8ff', 4, '🎣');
    showMsg(`🎣 First ${item.name}! Added to your logbook. Worth ~$${price}.`);
  } else {
    showMsg(`🎣 ${ITEMS[catch_.id]?.name || catch_.id}. Worth ~$${price}.`);
  }
  player.actionCooldown = 0.3;
}