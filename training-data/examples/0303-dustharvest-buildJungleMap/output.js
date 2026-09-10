function buildJungleMap() {
  if (_jungleMapBuilt) return;
  _jungleMapBuilt = true;
  jungleMap.fill(JG.GRASS);

  // Water — north edge (approach channel)
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < JG_W; x++)
      setJGT(x, y, y < 4 ? JG.WATER_DEEP : JG.WATER);

  // Eastern Dock — x:30–50, y:7–14
  for (let y = 7; y <= 14; y++)
    for (let x = 30; x <= 50; x++)
      setJGT(x, y, JG.DOCK);
  // Plank gangplank — x:39–41, y:14–16
  for (let y = 14; y <= 16; y++) { setJGT(39, y, JG.PLANK); setJGT(40, y, JG.PLANK); setJGT(41, y, JG.PLANK); }

  // Beach strip y:7–18, outside dock
  for (let y = 7; y <= 18; y++)
    for (let x = 0; x < JG_W; x++)
      if (getJGT(x, y) !== JG.DOCK && getJGT(x, y) !== JG.PLANK &&
          getJGT(x, y) !== JG.WATER && getJGT(x, y) !== JG.WATER_DEEP)
        setJGT(x, y, JG.SAND);

  // Road from dock south through village to cleared zone
  for (let y = 15; y <= 55; y++) { setJGT(39, y, JG.ROAD); setJGT(40, y, JG.ROAD); }

  // Village clearing — y:26–45, x:28–54
  for (let y = 26; y <= 45; y++)
    for (let x = 28; x <= 54; x++)
      setJGT(x, y, JG.JUNGLE_FLOOR);

  // Central campfire
  setJGT(40, 36, JG.CAMPFIRE);

  // The Cleared Zone — y:46–64, x:20–60
  for (let y = 46; y <= 64; y++)
    for (let x = 20; x <= 60; x++)
      setJGT(x, y, JG.MUD);

  // Jungle fringe — east edge + south edge become dense trees
  for (let y = 19; y < JG_H; y++)
    for (let x = 0; x < JG_W; x++) {
      const t = getJGT(x, y);
      if (t === JG.GRASS) {
        // Dense border ring
        const nearEdge = x < 4 || x >= JG_W - 4 || y >= JG_H - 4;
        const mid = x > 6 && x < JG_W - 6 && y > 19 && y < JG_H - 6;
        if (nearEdge) setJGT(x, y, JG.DENSE_TREE);
        else if (mid) {
          // Scattered jungle trees — deterministic from position
          const h = ((x * 7919 + y * 6271) & 0xFFFF) / 65535;
          if (h < 0.35) setJGT(x, y, JG.TREE);
          else if (h < 0.45) setJGT(x, y, JG.BUSH);
        }
      }
    }

  // Exit tile (return to ocean) — top edge near dock
  setJGT(40, 0, JG.EXIT); setJGT(41, 0, JG.EXIT);
}