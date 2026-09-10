function runIntro() {
  const screen = document.getElementById('introScreen');
  const deco   = document.getElementById('introDeco');
  const textEl = document.getElementById('introText');
  screen.classList.add('show');

  // fade in cactus
  const t0 = setTimeout(() => { deco.classList.add('vis'); }, 100);
  _introTimers.push(t0);

  let beatStart = 900; // ms after intro shows

  INTRO_BEATS.forEach((beat, i) => {
    const t = setTimeout(() => {
      if (_introSkipped) return;
      typewriterInto(textEl, beat.text, 38);
    }, beatStart);
    _introTimers.push(t);
    // each beat waits for its own type time + pause
    beatStart += beat.text.replace(/\n/g,'').length * 38 + beat.pause;
  });

  // final: fade out and start game
  const tEnd = setTimeout(() => {
    if (_introSkipped) return;
    finishIntro();
  }, beatStart + 400);
  _introTimers.push(tEnd);

  // skip on Enter key
  function onKey(e) {
    if (e.code === 'Enter' || e.code === 'Space') { skipIntro(); window.removeEventListener('keydown', onKey); }
  }
  window.addEventListener('keydown', onKey);
  // store remover so skipIntro can also clean it up
  _introKeyRemover = onKey;
}