function tickFishBite(dt) {
  if (_fish.phase === 'idle') return;

  if (_fish.phase === 'waiting') {
    _fish.biteTimer -= dt;
    if (_fish.biteTimer <= 0) {
      _fish.phase = 'biting';
      _fish.biteWindowElapsed = 0;
      _fish.biteWindow = 0.9 + (player._rodTier || 0) * 0.15;
      showMsg('🎣 !! BITE — press [E] now!');
    }
    return;
  }

  if (_fish.phase === 'biting') {
    _fish.biteWindowElapsed += dt;
    if (_fish.biteWindowElapsed >= _fish.biteWindow) {
      _fish.phase = 'idle';
      _fish.pendingCatch = null;
      if (_fish.baitId) { _fish.baitId = null; } // bait was never consumed — it's still in inventory
      showMsg('🎣 It got away. Cast again.');
      cancelAction('');
    }
    return;
  }
}