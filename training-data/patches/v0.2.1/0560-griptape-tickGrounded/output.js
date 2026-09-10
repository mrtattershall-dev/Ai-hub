function tickGrounded(dt) {
  if (!groundedState.active) return;
  groundedState.timer -= dt;
  updateGroundedDisplay();
  if (groundedState.timer <= 0) {
    groundedState.active = false;
    document.getElementById('grounded-overlay').classList.remove('show');
    // Academics recover slightly while grounded
    player.academics = Math.min(100, player.academics + 15);
    shopState.tuneUpActive = false; // tune-up expires when grounded
    gameRunning = true;
    toast('Curfew lifted. Academics recovered a bit.', 'success');
  }
}