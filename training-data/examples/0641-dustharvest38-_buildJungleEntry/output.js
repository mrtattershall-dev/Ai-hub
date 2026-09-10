function _buildJungleEntry() {
  if (!_jungleMapBuilt) return;

  for (let y = JG_ENTRY_Y; y < JG_H - 1; y++) {
    // Central road
    for (let x = 37; x <= 43; x++) setJGT(x, y, JG.ROAD);
    // Left corridor — x:20-31 (includes the x:21 gap that had sporadic trees)
    for (let x = 20; x <= 31; x++) {
      if (x >= JG_RUINS_X2 && y <= 66) continue; // don't overwrite ruins facade top row
      setJGT(x, y, JG.GRASS);
    }
    // Right corridor — x:49-61 (extended past x:58 to clear the east gap)
    for (let x = 49; x <= 61; x++) setJGT(x, y, JG.GRASS);
  }

  // Widen central path at Entry threshold
  for (let x = 33; x <= 47; x++) {
    setJGT(x, JG_ENTRY_Y,     JG.GRASS);
    setJGT(x, JG_ENTRY_Y + 1, JG.GRASS);
  }

  // Connect left corridor to ruins facade path (y:65-66 already set in buildJungleMap)
  // Ensure the strip y:64-66, x:15-23 is clear
  for (let x = 15; x <= 23; x++) {
    setJGT(x, 64, JG.GRASS);
    setJGT(x, 65, JG.GRASS);
    setJGT(x, 66, JG.GRASS);
  }
  // Restore the EXIT tiles for ruins entry trigger
  setJGT(13, 65, JG.EXIT);
  setJGT(14, 65, JG.EXIT);

  // Resource node tiles (re-stamped after corridor clearing)
  const herbSpots = [
    [32, 67],[35, 70],[48, 68],[46, 71],[26, 73],[54, 73],
    [36, 75],[43, 76],[33, 78],[53, 77],
  ];
  const woodSpots = [
    [32, 66],[51, 66],[27, 71],[57, 71],[42, 74],[38, 77],[47, 78],
  ];
  const mushSpots = [
    [34, 69],[48, 70],[41, 72],[45, 76],
  ];
  for (const [x, y] of herbSpots) {
    if (x >= JG_FARM_X1 && x <= JG_FARM_X2 && y >= JG_FARM_Y1 && y <= JG_FARM_Y2) continue;
    setJGT(x, y, JG.BUSH);
  }
  for (const [x, y] of woodSpots) setJGT(x, y, JG.TREE);
  for (const [x, y] of mushSpots) {
    if (getJGT(x, y) !== JG.DENSE_TREE) setJGT(x, y, JG.DIRT);
  }
}