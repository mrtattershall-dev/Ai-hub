function _buildAltaverdeRuins() {
  // Outer perimeter — WALL
  for (let y = JG_RUINS_Y1; y <= JG_RUINS_Y2; y++) {
    for (let x = JG_RUINS_X1; x <= JG_RUINS_X2; x++) {
      const onEdge = (x === JG_RUINS_X1 || x === JG_RUINS_X2 ||
                      y === JG_RUINS_Y1 || y === JG_RUINS_Y2);
      if (onEdge) { setJGT(x, y, JG.WALL); continue; }
      setJGT(x, y, JG.FLOOR);
    }
  }

  // Interior dividing walls — creates 3 rooms
  // Room 1 (entry hall): x:5-20, y:65-69
  // Room 2 (processing floor): x:5-20, y:70-74
  // Room 3 (archive/deep): x:5-20, y:75-79
  for (let x = JG_RUINS_X1; x <= JG_RUINS_X2; x++) {
    if (x !== 12 && x !== 13) { // doorway at x:12-13
      setJGT(x, 69, JG.WALL);
    }
    if (x !== 9 && x !== 10) { // doorway at x:9-10
      setJGT(x, 74, JG.WALL);
    }
  }

  // Rubble / rock scatter inside rooms (decorative obstacles)
  const rubbleSpots = [
    [7,66],[10,67],[15,66],[18,67],[17,68],
    [6,71],[14,72],[19,71],[11,73],[8,73],
    [6,76],[13,75],[18,76],[7,78],[15,78],
  ];
  for (const [x, y] of rubbleSpots) {
    if (x > JG_RUINS_X1 && x < JG_RUINS_X2 && y > JG_RUINS_Y1 && y < JG_RUINS_Y2) {
      setJGT(x, y, JG.ROCK);
    }
  }

  // Entry path — connects ruins to central road corridor at x:38-42
  // Carve a grass path: x:20-38, y:68
  for (let x = JG_RUINS_X2; x <= 37; x++) {
    if (getJGT(x, 68) !== JG.DENSE_TREE) setJGT(x, 68, JG.GRASS);
  }

  // Path entrance tile (marks the ruins opening in the map)
  setJGT(JG_RUINS_ENTRY_TX, JG_RUINS_ENTRY_TY, JG.FLOOR);
}