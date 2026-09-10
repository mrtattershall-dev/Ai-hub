function getNearbyJGNode() {
  if (!gameState.inJungle) return null;
  const px = Math.floor(player.x / JG_T);
  const py = Math.floor(player.y / JG_T);
  const offs = { down:[0,1], up:[0,-1], left:[-1,0], right:[1,0] };
  const [ox, oy] = offs[player.facing] || [0, 1];
  const checks = [
    [px + ox, py + oy], [px + ox*2, py + oy*2], [px, py],
    [px+1, py], [px-1, py], [px, py+1], [px, py-1],
  ];
  for (const [cx, cy] of checks) {
    const key = cx + ',' + cy;
    const node = jgResourceNodes[key];
    if (!node || node.depleted) continue;
    if (getJGT(cx, cy) !== node.def.tile) { node.depleted = true; continue; }
    return { key, node };
  }
  return null;
}