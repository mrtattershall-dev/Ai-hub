function getNearbyBLNode() {
  const px=Math.floor(player.x/T), py=Math.floor(player.y/T);
  const nodeOffs={down:[0,1],up:[0,-1],left:[-1,0],right:[1,0]};
  const [ox,oy]=nodeOffs[player.facing]||[0,1];
  const checks=[
    [px+ox,py+oy],[px+ox*2,py+oy*2],[px,py],
    [px+1,py],[px-1,py],[px,py+1],[px,py-1],
  ];
  for(const [cx,cy] of checks) {
    const key=cx+','+cy;
    const node=badlandsNodes[key];
    if(!node||node.depleted) continue;
    return key;
  }
  return null;
}