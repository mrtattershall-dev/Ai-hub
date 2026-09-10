function startAction(label, duration, onComplete, cancelOnMove=true) {
  actionTimer.active     = true;
  actionTimer.elapsed    = 0;
  actionTimer.duration   = duration;
  actionTimer.label      = label;
  actionTimer.onComplete = onComplete;
  actionTimer.cancelOnMove = cancelOnMove;
  actionTimer._wasMoving = false;
  const ap = document.getElementById('actionProgress');
  document.getElementById('apLabel').textContent = label;
  document.getElementById('apFill').style.width = '0%';
  ap.classList.add('show');
}