function _buildJungleEntry() {
  if (!_jungleMapBuilt) return; // safety — call after buildJungleMap

  // Carve two traversal corridors through the dense fringe into Entry:
  //   Left  corridor: x:24-28, y:65-79 — GRASS floor, trees either side
  //   Right corridor: x:52-56, y:65-79 — same
  //   Central path:   x:38-42, y:65-79 — road tile (continuation of village road)
  for (let y = JG_ENTRY_Y; y < JG_H; y++) {
    // Central road continuation
    for (let x = 38; x <= 42; x++) {
      if (getJGT(x, y) !== JG.DENSE_TREE) setJGT(x, y, JG.ROAD);
    }
    // Left corridor
    for (let x = 24; x <= 28; x++) {
      if (getJGT(x, y) !== JG.DENSE_TREE && getJGT(x, y) !== JG.TREE) setJGT(x, y, JG.GRASS);
    }
    // Right corridor
    for (let x = 52; x <= 56; x++) {
      if (getJGT(x, y) !== JG.DENSE_TREE && getJGT(x, y) !== JG.TREE) setJGT(x, y, JG.GRASS);
    }
  }

  // Widen central path slightly with grass shoulders at Entry threshold
  for (let x = 35; x <= 45; x++) {
    if (getJGT(x, JG_ENTRY_Y) !== JG.DENSE_TREE) setJGT(x, JG_ENTRY_Y, JG.GRASS);
    if (getJGT(x, JG_ENTRY_Y + 1) !== JG.DENSE_TREE) setJGT(x, JG_ENTRY_Y + 1, JG.GRASS);
  }

  // Place gathering node indicator tiles — BUSH tiles that become jgHerb nodes,
  // and specific TREE tiles that become jgWood nodes.
  // We mark them deterministically so buildJGResourceNodes can find them.
  const herbSpots = [
    [30, 67],[33, 70],[48, 68],[44, 71],[26, 73],[54, 73],
    [36, 75],[43, 76],[31, 78],[51, 77],
  ];
  const woodSpots = [
    [29, 66],[50, 66],[25, 71],[56, 71],[40, 74],[37, 77],[45, 78],
  ];
  const mushSpots = [
    [32, 69],[47, 69],[39, 72],[41, 76],
  ];

  for (const [x, y] of herbSpots) {
    if (x >= JG_FARM_X1 && x <= JG_FARM_X2 && y >= JG_FARM_Y1 && y <= JG_FARM_Y2) continue;
    setJGT(x, y, JG.BUSH);
  }
  for (const [x, y] of woodSpots) {
    setJGT(x, y, JG.TREE); // gatherable wood node
  }
  for (const [x, y] of mushSpots) {
    // Mushroom nodes — FLOOR tile with a special marker (we use JG.DIRT)
    if (getJGT(x, y) !== JG.DENSE_TREE) setJGT(x, y, JG.DIRT);
  }
}