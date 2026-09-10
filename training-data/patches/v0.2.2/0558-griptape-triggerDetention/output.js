function triggerDetention() {
  if (vance.detentionActive) return;
  vance.detentionActive = true;
  vance.detentionTimer = DETENTION_DURATION;
  vance.state = 'returning';
  gameRunning = false;
  player.vel.set(0,0,0);
  player.academics = Math.max(0, player.academics - 20);
  player.clout     = Math.max(0, player.clout - 10);
  elDetentionOverlay.classList.add('show');
  updateDetentionTimer();
  toast('Detention! Academics -20, Clout -10', 'danger');
}