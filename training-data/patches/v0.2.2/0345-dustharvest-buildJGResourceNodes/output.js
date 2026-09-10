function buildJGResourceNodes() {
  // Scan Jungle Entry area for gatherable tiles
  for (let y = JG_ENTRY_Y; y < JG_H; y++) {
    for (let x = 0; x < JG_W; x++) {
      const t = getJGT(x, y);
      const def = JG_RESOURCE_NODE_DEFS.find(d => d.tile === t);
      if (def) {
        jgResourceNodes[x + ',' + y] = { x, y, def, depleted: false, respawnDay: 0 };
      }
    }
  }
}