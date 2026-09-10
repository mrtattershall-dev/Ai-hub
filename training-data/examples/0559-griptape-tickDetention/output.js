function tickDetention(dt) {
  if (!vance.detentionActive) return;
  vance.detentionTimer -= dt;
  updateDetentionTimer();
  if (vance.detentionTimer <= 0) {
    vance.detentionActive = false;
    elDetentionOverlay.classList.remove('show');
    player.academics = Math.min(100, player.academics + 5); // small recovery
    gameRunning = true;
    vance.state = 'patrol';
    toast('Detention served. Try not to get caught again.', '');
  }
}