function updateJungleMovement(dx, dy, dt, spd) {
  if (!gameState.inJungle) return;
  const moveSpd = spd || 90;
  let nx = player.x + dx * moveSpd * dt;
  let ny = player.y + dy * moveSpd * dt;
  const hw = 10, hh = 10;
  // Clamp strictly inside map bounds BEFORE solid check
  nx = Math.max(hw + JG_T, Math.min(JG_W * JG_T - hw - JG_T, nx));
  ny = Math.max(hh + JG_T, Math.min(JG_H * JG_T - hh - JG_T, ny));
  function solid(bx, by) {
    const corners = [
      [bx - hw, by - hh], [bx + hw, by - hh],
      [bx - hw, by + hh], [bx + hw, by + hh],
    ];
    return corners.some(([cx, cy]) => getJGSolid(Math.floor(cx / JG_T), Math.floor(cy / JG_T)));
  }
  if (!solid(nx, player.y)) player.x = nx;
  if (!solid(player.x, ny)) player.y = ny;
  revealAround(player.x, player.y, WORLD_REVEAL_RADIUS + 1, exploredJungle, JG_W, JG_H);
  _tickJungleArrival(dt);
}