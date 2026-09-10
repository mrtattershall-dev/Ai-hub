function updateWarp() {
  const inZone=player.flow>=80;
  const targetWarp = inZone ? 6 : 0;
  warpAmount += (targetWarp - warpAmount) * 0.05;
  const warpStr = warpAmount.toFixed(2);
  if (dispEl && dispEl.getAttribute('scale') !== warpStr) dispEl.setAttribute('scale', warpStr);
  if (inZone || warpAmount > 0.1) {
    canvas.style.filter='url(#warp-filter)';
    canvas.style.transform='scale(1.005)';
  } else {
    canvas.style.filter='none';
    canvas.style.transform='none';
  }
}