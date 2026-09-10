function unstickPlayer() {
  // Snap to tile centre first — eliminates edge-of-tile corner traps
  player.x = Math.floor(player.x / T) * T + T / 2;
  player.y = Math.floor(player.y / T) * T + T / 2;
  const step = T * 0.9;
  function canMove() {
    if (collideSolid(player.x, player.y)) return false;
    return (
      !collideSolid(player.x + step, player.y) ||
      !collideSolid(player.x - step, player.y) ||
      !collideSolid(player.x, player.y + step) ||
      !collideSolid(player.x, player.y - step)
    );
  }
  if (canMove()) return;
  const startTX = Math.floor(player.x / T);
  const startTY = Math.floor(player.y / T);
  outer: for (let r = 1; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        player.x = (startTX + dx) * T + T / 2;
        player.y = (startTY + dy) * T + T / 2;
        if (canMove()) break outer;
      }
    }
  }
}