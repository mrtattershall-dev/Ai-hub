function tickSprinklers() {
  for (const [tx2, ty2] of getSprinklerPositions()) {
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = tx2+dx, ny = ty2+dy;
      const pk = plotKey(nx, ny);
      const p = plots[pk];
      if (p && p.tilled && !p.wateredToday && !p.harvestReady) {
        p.watered = p.wateredToday = true;
        p.wilted = false;
        setT(nx, ny, TL.FARM_WATERED);
      }
    }
  }
}