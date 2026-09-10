function respawnNodes() {
  for (const key in resourceNodes) {
    const n = resourceNodes[key];
    if (n.depleted && n.respawnDay !== Infinity && gameState.day >= n.respawnDay) {
      n.depleted = false;
    }
  }
  // Also respawn mine nodes
  for (let fl = 0; fl < MINE_FLOORS; fl++) {
    for (const key in mineResourceNodes[fl]) {
      const n = mineResourceNodes[fl][key];
      if (n.depleted && gameState.day >= n.respawnDay) {
        n.depleted = false;
        setMineT(fl, n.x, n.y, n.def.tile);
      }
    }
  }
}