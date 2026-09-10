function _buildAncientCourtZone() {
  // Outer ring — ancient walls
  for (let y = 42; y <= 54; y++) {
    for (let x = 2; x <= 16; x++) {
      const onEdge = (x === 2 || x === 16 || y === 42 || y === 54);
      setDJT(x, y, onEdge ? JG.ANCIENT_WALL : JG.ANCIENT_FLOOR);
    }
  }
  // Carved doorway facing east
  setDJT(16, 47, JG.ANCIENT_FLOOR);
  setDJT(16, 48, JG.ANCIENT_FLOOR);
  // Interior — slightly irregular
  const h = ((7 * 1301 + 47 * 1103) & 0xFFFF) / 65535;
  for (let dy = 1; dy <= 11; dy++) {
    for (let dx = 1; dx <= 13; dx++) {
      const fh = ((dx * 1301 + dy * 1103) & 0xFFFF) / 65535;
      if (fh < 0.06) setDJT(2+dx, 42+dy, JG.ANCIENT_WALL); // interior pillars
    }
  }
  // Path from main corridor to court entrance
  for (let x = 17; x <= 39; x++) {
    if (!JG_SOLID.has(getDJT(x, 48))) setDJT(x, 48, JG.ANCIENT_FLOOR);
  }
}