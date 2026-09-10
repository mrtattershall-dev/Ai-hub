function updateGroundedDisplay() {
  const mins = Math.floor(groundedState.timer / 60);
  const secs = Math.floor(groundedState.timer % 60);
  elGroundedTimer.textContent =
    String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
  const acad = Math.round(player.academics);
  const clout = Math.round(player.clout);
  const skate = Math.round(player.skate);
  const acadEl = document.getElementById('gs-acad');
  acadEl.textContent = acad;
  acadEl.className = 'gs-val ' + (acad < THRESH.academics.ground ? 'bad' : 'ok');
  document.getElementById('gs-clout').textContent = clout;
  document.getElementById('gs-skate').textContent = skate;
}