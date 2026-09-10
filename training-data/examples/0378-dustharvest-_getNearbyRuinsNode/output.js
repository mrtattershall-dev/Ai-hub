function _getNearbyRuinsNode() {
  if (!gameState.inJungle) return null;
  const ptx = Math.floor(player.x / JG_T);
  const pty = Math.floor(player.y / JG_T);
  const offs = [[0,0],[1,0],[-1,0],[0,1],[0,-1]];
  const dir = { down:[0,1], up:[0,-1], left:[-1,0], right:[1,0] }[player.facing] || [0,1];
  offs.push(dir);
  for (const [dx, dy] of offs) {
    const key = (ptx + dx) + ',' + (pty + dy);
    const node = JG_RUINS_NODES[key];
    if (node && !node.depleted) return { key, node };
  }
  return null;
}