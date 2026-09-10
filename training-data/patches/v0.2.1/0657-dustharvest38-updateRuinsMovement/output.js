function updateRuinsMovement(dx, dy, dt, spd) {
  if (!gameState.inRuins) return;
  const moveSpd = spd || 80;
  const hw = 10, hh = 10;
  let nx = player.x + dx * moveSpd * dt;
  let ny = player.y + dy * moveSpd * dt;
  nx = Math.max(hw + RU_T, Math.min(RU_W * RU_T - hw - RU_T, nx));
  ny = Math.max(hh + RU_T, Math.min(RU_H * RU_T - hh - RU_T, ny));

  function solid(bx, by) {
    const corners = [[bx-hw,by-hh],[bx+hw,by-hh],[bx-hw,by+hh],[bx+hw,by+hh]];
    return corners.some(([cx,cy]) => getRUSolid(Math.floor(cx/RU_T), Math.floor(cy/RU_T)));
  }
  if (!solid(nx, player.y)) player.x = nx;
  if (!solid(player.x, ny)) player.y = ny;

  const ptx = Math.floor(player.x/RU_T), pty = Math.floor(player.y/RU_T);
  _revealRuinsArea(ptx, pty, 4);
  _tickRuinsGuardSpawns(dt);

  // ASCEND = exit back to jungle
  if (getRUT(ptx, pty) === JG.ASCEND || getRUT(ptx, Math.max(0,pty-1)) === JG.ASCEND) {
    exitRuins(); return;
  }
  // Check ruins documents by proximity
  _checkRuinsDocuments();
}