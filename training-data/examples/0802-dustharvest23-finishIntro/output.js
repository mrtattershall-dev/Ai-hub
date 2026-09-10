function finishIntro() {
  const screen = document.getElementById('introScreen');
  screen.style.transition = 'opacity .7s';
  screen.style.opacity = '0';
  setTimeout(() => {
    screen.classList.remove('show');
    screen.style.opacity = '';
    screen.style.transition = '';
    document.getElementById('introText').textContent = '';
    document.getElementById('introDeco').classList.remove('vis');
    // Show controls on first new game
    showControlsIfNeeded();
  }, 700);
  showMsg("Day 1, Elias. The hoe won't swing itself.");
  dSound('dawn');
}