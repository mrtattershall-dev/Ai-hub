function castOceanFishing() {
  if (!countItem('fishingRod')) {
    showMsg('🎣 Need a fishing rod. Buy one at the market upgrades tab.');
    return;
  }
  if (player.stamina < 5) { showMsg('⚠️ Too tired to fish.'); return; }
  if (actionTimer.active) { cancelAction(''); return; }

  const tier     = getBoatTier();
  // Trusted ocean rep: sloop gets deep-water access (normally requires schooner)
  const _ocTrusted = getRepTier('ocean')=== 'trusted' || getRepTier('ocean')==='revered';
  const deepOk   = tier && (tier.deepAccess || (_ocTrusted && tier.id==='boat_sloop'));
  const isNight  = gameState.isNight || gameState.timeOfDay/60 >= 20 || gameState.timeOfDay/60 < 5;

  // Choose table — deep if schooner+, shallow otherwise
  // Night: slight boost to rare items handled by skewed roll below
  const useDeep = deepOk;
  const table   = useDeep ? OCEAN_DEEP_TABLE   : OCEAN_SHALLOW_TABLE;
  const total   = useDeep ? OCEAN_DEEP_TOTAL   : OCEAN_SHALLOW_TOTAL;

  // Cast time: dock = 3.5–5.5s, boat = 4–7s (deeper = longer wait)
  const castTime = useDeep
    ? 4.0 + Math.random() * 3.0
    : 3.5 + Math.random() * 2.0;
  const label = useDeep ? '🎣 Deep-water fishing…' : '🎣 Dock fishing…';

  startAction(label, castTime, () => {
    // Night modifier: reroll once if first pick is common, bias toward rare
    let roll = Math.random() * total;
    if (isNight) {
      // 40% chance to reroll and take the rarer result
      const roll2 = Math.random() * total;
      roll = Math.min(roll, roll2); // lower roll = further into rare tail
    }

    let catch_ = null;
    let acc = 0;
    for (const f of table) {
      acc += f.weight;
      if (roll < acc) { catch_ = f; break; }
    }
    catch_ = catch_ || table[table.length-1];

    // Night-only special: very small chance of jellyfish regardless of table
    if (isNight && Math.random() < 0.04) {
      showMsg('🎣 🪼 Bioluminescent jellyfish drifted past the line. You don\'t take it. Some things are better left in the water.');
      gainRep('ocean', 1);
      return;
    }

    // Leatherback gets released
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

    addItem(catch_.id, 1);
    trackFish && trackFish(catch_.id);
    player.stamina = Math.max(0, player.stamina - 5);
    gainRep('ocean', 1);

    // Catch messages — honest, not congratulatory
    const price = economy.prices[catch_.id] || BASE_PRICES[catch_.id] || 0;
    if (catch_.id === 'junkBoot') {
      showMsg('🎣 Waterlogged boot. The sea gives what the sea has.');
    } else if (catch_.id === 'netScraps') {
      showMsg('🎣 Net scraps. Not nothing — some salvageable rope.');
    } else if (catch_.id === 'barnacledBottle') {
      showMsg('🎣 A sealed bottle. Something\'s inside. Could be nothing.');
    } else if (catch_.id === 'shipTimber') {
      showMsg(`🎣 Ship timber — dense hardwood from a wreck. Worth $${price}.`);
    } else if (catch_.id === 'corrodedFlask') {
      showMsg('🎣 Deep-corroded flask. Whatever was in it left a stain.');
    } else if (catch_.id === 'navalChart') {
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
    } else {
      const fishName = ITEMS[catch_.id]?.name || catch_.id;
      showMsg(`🎣 ${fishName}. Worth ~$${price}.`);
    }
    player.actionCooldown = 0.3;
  }, true);
}