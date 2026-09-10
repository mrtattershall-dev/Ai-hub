function castOceanFishing() {
  if (!countItem('fishingRod')) {
    showMsg('🎣 Need a fishing rod. Buy one at the market upgrades tab.');
    return;
  }
  if (player.stamina < 5) { showMsg('⚠️ Too tired to fish.'); return; }

  // Bite window — same E-press mechanic as river fishing
  if (_fish.phase === 'biting') { _fish.phase = 'reeling'; _reelCatchOcean(); return; }
  if (_fish.phase === 'waiting') { showMsg('🎣 Line is in. Wait for the bite…'); return; }
  if (actionTimer.active) { cancelAction(''); _fish.phase = 'idle'; return; }

  const tier       = getBoatTier();
  const _ocTrusted = getRepTier('ocean')==='trusted' || getRepTier('ocean')==='revered';
  const deepOk     = tier && (tier.deepAccess || (_ocTrusted && tier.id==='boat_sloop'));
  const isNight    = gameState.isNight || gameState.timeOfDay/60 >= 20 || gameState.timeOfDay/60 < 5;
  const useDeep    = deepOk;
  const table      = useDeep ? OCEAN_DEEP_TABLE : OCEAN_SHALLOW_TABLE;
  const total      = useDeep ? OCEAN_DEEP_TOTAL : OCEAN_SHALLOW_TOTAL;

  // Pre-roll catch with rod and night bonuses
  const rod = getRodBonus();
  let roll = Math.random() * total;
  if (isNight) { const r2 = Math.random() * total; roll = Math.min(roll, r2); }
  // Apply rod rare mult to the roll (bias toward low-weight rarities)
  const adjTable = table.map(f => ({ ...f, weight: f.weight <= 8 ? f.weight * rod.rareMult : f.weight }));
  const adjTotal = adjTable.reduce((s,f)=>s+f.weight,0);
  let catch_ = null, acc = 0;
  const adjRoll = Math.random() * adjTotal;
  for (const f of adjTable) { acc += f.weight; if (adjRoll < acc) { catch_ = f; break; } }
  catch_ = catch_ || adjTable[adjTable.length-1];

  // Special jellyfish — overrides catch but only triggers at bite phase
  _fish._oceanJellyfish = isNight && Math.random() < 0.04;
  _fish._oceanIsNight   = isNight;
  _fish.pendingCatch    = catch_;
  _fish.baitId          = null; // no bait system for ocean
  _fish.phase           = 'idle';

  const castMult = rod.castMult;
  const castTime = useDeep ? (4.0 + Math.random()*3.0)*castMult : (3.5 + Math.random()*2.0)*castMult;
  _fish.biteTimer = 0.3 + Math.random() * 0.9;

  startAction(useDeep ? '🎣 Deep-water cast…' : '🎣 Dock cast…', castTime, () => {
    _fish.phase = 'waiting';
  }, true);
}