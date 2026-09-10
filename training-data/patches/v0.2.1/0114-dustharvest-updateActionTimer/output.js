function updateActionTimer(dt, isMoving) {
  if (!actionTimer.active) return;
  if (actionTimer.cancelOnMove && isMoving) {
    cancelAction('');   // silent cancel on move — just stop bar
    return;
  }
  actionTimer.elapsed += dt;
  const pct = Math.min(100, (actionTimer.elapsed / actionTimer.duration) * 100);
  document.getElementById('apFill').style.width = pct + '%';
  if (actionTimer.elapsed >= actionTimer.duration) {
    actionTimer.active = false;
    document.getElementById('actionProgress').classList.remove('show');
    const cb = actionTimer.onComplete;
    actionTimer.onComplete = null;
    if (cb) cb();
  }
}