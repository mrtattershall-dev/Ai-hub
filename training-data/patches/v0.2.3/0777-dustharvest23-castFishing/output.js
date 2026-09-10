function castFishing() {
  if (!countItem('fishingRod')) {
    showMsg('🎣 You need a Fishing Rod! Buy one at the market Upgrades tab.');
    return;
  }
  if (player.stamina < 5) { showMsg('⚠️ Too tired to fish — rest first.'); return; }
  if (actionTimer.active) { cancelAction(''); return; }

  // Determine region — hobo camp creek vs overworld pond
  const inCreek = gameState.inHoboCamp;
  const table  = inCreek ? CREEK_FISH_TABLE : FISH_TABLE;
  const total  = inCreek ? CREEK_FISH_TOTAL  : FISH_TOTAL_WEIGHT;
  const castLabel = inCreek ? '🎣 Creek fishing…' : '🎣 Fishing…';
  // Creek casts faster — smaller water
  const castTime = inCreek ? (2.5 + Math.random() * 2) : (3.5 + Math.random() * 2.5);

  startAction(castLabel, castTime, () => {
    const catch_ = rollFishCatch(table, total);
    const item = ITEMS[catch_.id];
    if (!item) { showMsg(`🎣 Something took the bait…`); return; }
    if (inventory.totalWeight + (item.weight||1) > getEffectiveWeightCap()) {
      showMsg('⚠️ Bag too heavy to carry the catch!');
      return;
    }
    addItem(catch_.id, 1);
    trackFish(catch_.id);
    player.stamina = Math.max(0, player.stamina - 5);

    // Special messages per catch
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
      showMsg(`🎣 🐢 Snapper Turtle — tough catch. Worth $${BASE_PRICES.snapperTurtle} if you can sell it.`);
    } else {
      const price = economy.prices[catch_.id] || BASE_PRICES[catch_.id] || 0;
      showMsg(`🎣 Caught ${catch_.label}! Worth ~$${price} at market.`);
    }
    player.actionCooldown = 0.3;
  }, true);
}