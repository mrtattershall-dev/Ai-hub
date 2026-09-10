function updateStickHud(hspd) {
  if (!player.isOllying && player.onGround) {
    elStickHud.classList.remove('visible');
    return;
  }
  elStickHud.classList.add('visible');
  // Left stick = movement direction
  const lx = -Math.sin(player.facing)*25 * (hspd/MAX_SPEED);
  const lz = -Math.cos(player.facing)*25 * (hspd/MAX_SPEED);
  const ld=elLStickDot;
  ld.style.left = (50 + lx) + '%'; ld.style.top = (50 + lz) + '%';
  // Right stick = current flick direction
  const dir = getFlickDir();
  const rd=elRStickDot;
  const rx = dir ? (dir.includes('right') ? 25 : dir.includes('left') ? -25 : 0) : 0;
  const rz = dir ? (dir.includes('up')    ? -25 : dir.includes('down') ? 25  : 0) : 0;
  rd.style.left = (50+rx)+'%'; rd.style.top = (50+rz)+'%';
}