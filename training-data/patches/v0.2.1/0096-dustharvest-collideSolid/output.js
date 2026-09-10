function collideSolid(nx,ny) {
  if (gameState.inBLMine) {
    const hw=player.w/2-2, hh=player.h/2-2;
    const fl = gameState.blMineFloor;
    for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]]) {
      const t = getBLMineT(fl, Math.floor(cx/T), Math.floor(cy/T));
      if (t === TL.MINE_WALL) return true;
    }
    return false;
  }
  if (gameState.inMine) {
    const hw=player.w/2-2, hh=player.h/2-2;
    const fl = gameState.mineFloor;
    for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]]) {
      const t = getMineT(fl, Math.floor(cx/T), Math.floor(cy/T));
      if (t === TL.MINE_WALL) return true;
    }
    return false;
  }
  if (gameState.inBadlands) {
    const hw=player.w/2-2, hh=player.h/2-2;
    for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]])
      if (BL_SOLID.has(getBLT(Math.floor(cx/T),Math.floor(cy/T)))) return true;
    return false;
  }
  if (gameState.inHoboCamp) {
    const hw=player.w/2-2, hh=player.h/2-2;
    for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]])
      if (HC_SOLID_SET.has(getHCT(Math.floor(cx/HC_T),Math.floor(cy/HC_T)))) return true;
    return false;
  }
  if (gameState.inOcean) {
    const hw=player.w/2-2, hh=player.h/2-2;
    for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]])
      if (getOCSolid(Math.floor(cx/OC_T),Math.floor(cy/OC_T))) return true;
    return false;
  }
  const hw=player.w/2-2, hh=player.h/2-2;
  for (const [cx,cy] of [[nx-hw,ny-hh],[nx+hw,ny-hh],[nx-hw,ny+hh],[nx+hw,ny+hh]])
    if (SOLID.has(getT(Math.floor(cx/T),Math.floor(cy/T)))) return true;
  return false;
}