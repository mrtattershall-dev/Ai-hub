function getBLMineNearbyNode() {
  const fl = gameState.blMineFloor;
  const nodes = blMineResourceNodes[fl];
  const px=Math.floor(player.x/T), py=Math.floor(player.y/T);
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const key=(px+dx)+','+(py+dy);
    const n = nodes[key];
    if (n && !n.depleted) return { key, node:n };
  }
  return null;
}