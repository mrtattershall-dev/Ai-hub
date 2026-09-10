function castFishing() {
  if (!countItem('fishingRod')) {
    showMsg('🎣 You need a Fishing Rod. Buy one at the market Upgrades tab.');
    return;
  }
  if (player.stamina < 5) { showMsg('⚠️ Too tired to fish — rest first.'); return; }

  // If we're in biting phase — this E press is the hook!
  if (_fish.phase === 'biting') {
    _fish.phase = 'reeling';
    _fish.biteTimer = 0;
    _reelCatch();
    return;
  }

  // If line is in the water waiting for a bite, give feedback
  if (_fish.phase === 'waiting') {
    showMsg('🎣 Line is in. Wait for the bite…');
    return;
  }

  if (actionTimer.active) { cancelAction(''); _fish.phase = 'idle'; return; }

  const inCreek = gameState.inHoboCamp;
  const table   = inCreek ? CREEK_FISH_TABLE : FISH_TABLE;
  const total   = inCreek ? CREEK_FISH_TOTAL : FISH_TOTAL_WEIGHT;

  // Peek bait (don't consume yet — consume only when catch lands)
  _fish.baitId = useBait();
  if (_fish.baitId) showMsg(`🪱 Using ${ITEMS[_fish.baitId]?.name || _fish.baitId} as bait.`);

  // Roll catch now (with time/season/bait/rod bonuses) so it's ready when they press E
  const timeMult   = getFishTimeBonus();
  const seasonMult = getFishSeasonBonus();
  const baseTable  = table.map(f => ({ ...f, weight: f.weight * (f.weight<=6 ? timeMult*seasonMult : 1) }));
  const baseTotal  = baseTable.reduce((s,f)=>s+f.weight,0);
  _fish.pendingCatch = rollFishCatchWithBonuses(baseTable, baseTotal);

  // Cast time: base 3.5-6s, reduced by rod tier
  const rod = getRodBonus();
  const baseCast = inCreek ? (2.0 + Math.random() * 1.5) : (3.5 + Math.random() * 2.5);
  const castTime = baseCast * rod.castMult;

  // Bite window opens after castTime — wait time is 0.3–1.2s after cast completes
  _fish.biteTimer = 0.3 + Math.random() * 0.9;
  _fish.phase = 'idle'; // will flip to 'waiting' when cast completes

  const label = inCreek ? '🎣 Creek cast…' : '🎣 Cast…';
  startAction(label, castTime, () => {
    _fish.phase = 'waiting';
  }, true);
}