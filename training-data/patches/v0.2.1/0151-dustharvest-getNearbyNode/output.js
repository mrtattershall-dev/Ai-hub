function getNearbyNode() {
  const px = Math.floor(player.x/T), py = Math.floor(player.y/T);
  // Prioritise the tile the player is facing, then full adjacent ring
  const nodeOffs = { down:[0,1], up:[0,-1], left:[-1,0], right:[1,0] };
  const [ox,oy] = nodeOffs[player.facing]||[0,1];
  const orderedChecks = [
    [px+ox,   py+oy  ],   // 1 tile ahead
    [px+ox*2, py+oy*2],   // 2 tiles ahead
    [px,      py     ],   // own tile
    [px+1,py],[px-1,py],[px,py+1],[px,py-1], // full ring
    [px+1,py+1],[px-1,py-1],[px+1,py-1],[px-1,py+1],
  ];
  for (const [cx,cy] of orderedChecks) {
    const key = cx+','+cy;
    const node = resourceNodes[key];
    if (!node || node.depleted) continue;
    // Verify the tile on the map still matches what this node expects
    if (getT(cx, cy) !== node.def.tile) { node.depleted = true; continue; }
    return { key, node };
  }
  return null;
}