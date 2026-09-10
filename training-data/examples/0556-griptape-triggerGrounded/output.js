function triggerGrounded(reason) {
  if (groundedState.active) return;
  groundedState.active = true;
  groundedState.timer = CURFEW_DURATION;
  groundedState.reason = reason;
  // Freeze game
  gameRunning = false;
  player.vel.set(0,0,0);
  const overlay = document.getElementById('grounded-overlay');
  document.getElementById('grounded-sub').innerHTML = reason;
  overlay.classList.add('show');
  updateGroundedDisplay();
  toast('GROUNDED — wait for curfew to lift', 'danger');
}