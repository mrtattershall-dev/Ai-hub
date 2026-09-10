function updateBruise() {
  const b=player.bruise;
  elBruiseFill.style.width=b+'%';
  const label=elBruiseLabel;
  const hint=elRecoveryHint;
  if (b >= 75) {
    label.style.color='#ef5350';
    hint.style.opacity='1';
    hint.textContent='REST AT HOME\nOR SIT IN CLASS';
  } else if (b >= 40) {
    label.style.color='#ff9800';
    hint.style.opacity='1';
    hint.textContent='FIND AN ICE PACK';
  } else {
    label.style.color='#aaa';
    hint.style.opacity='0';
  }
}