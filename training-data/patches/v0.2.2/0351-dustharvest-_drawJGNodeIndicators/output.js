function _drawJGNodeIndicators(cx, cy, c) {
  // Draw small gather prompt icon above non-depleted nodes near player
  const px = player.x, py = player.y;
  for (const key in jgResourceNodes) {
    const n = jgResourceNodes[key];
    if (n.depleted) continue;
    const wx = n.x * JG_T + JG_T / 2, wy = n.y * JG_T + JG_T / 2;
    if (Math.hypot(px - wx, py - wy) > JG_T * 3) continue;
    if (!exploredJungle[n.y * JG_W + n.x]) continue;
    const sx = wx - cx, sy = wy - cy;
    c.globalAlpha = 0.7;
    c.font = '10px serif'; c.textAlign = 'center';
    c.fillText(n.def.icon, sx, sy - JG_T / 2 - 2);
    c.globalAlpha = 1;
  }
}