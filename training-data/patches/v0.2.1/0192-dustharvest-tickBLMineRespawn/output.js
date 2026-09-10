function tickBLMineRespawn() {
  for (let fl=0; fl<BL_MINE_FLOORS; fl++) {
    for (const key in blMineResourceNodes[fl]) {
      const n = blMineResourceNodes[fl][key];
      if (n.depleted && gameState.day >= n.respawnDay) {
        n.depleted = false;
        setBLMineT(fl, n.x, n.y, n.def.tile);
      }
    }
  }
}