function buildResourceNodes() {
  // Scan wilderness + mine tiles for gatherable resources
  // Exclude Ranch zone (x0-33, y36-72) — animals live there, not resources
  for (let y = 36; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x < RANCH_ZONE_X_MAX && y < RANCH_ZONE_Y_MAX) continue; // skip Ranch zone
      const t = getT(x, y);
      const def = RESOURCE_NODE_DEFS.find(d => d.tile === t);
      if (def) {
        resourceNodes[x+','+y] = { x, y, def, depleted:false, respawnDay:0 };
      }
    }
  }
}