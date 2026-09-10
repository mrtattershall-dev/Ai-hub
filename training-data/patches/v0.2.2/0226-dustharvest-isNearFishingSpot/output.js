function isNearFishingSpot() {
  // In hobo camp — near water tiles in the creek
  if (gameState.inHoboCamp) {
    const ptx = Math.floor(player.x / HC_T), pty = Math.floor(player.y / HC_T);
    const checks = [[ptx,pty],[ptx,pty-1],[ptx,pty+1],[ptx-1,pty],[ptx+1,pty]];
    return checks.some(([cx,cy]) => getHCT(cx,cy) === TL.WATER);
  }
  const ptx = Math.floor(player.x / T), pty = Math.floor(player.y / T);
  const checks = [[ptx,pty],[ptx,pty-1],[ptx,pty+1],[ptx-1,pty],[ptx+1,pty],
                  [ptx-1,pty-1],[ptx+1,pty-1]];
  return checks.some(([cx,cy]) => getT(cx,cy) === TL.FISHING_SPOT || getT(cx,cy) === TL.WATER);
}