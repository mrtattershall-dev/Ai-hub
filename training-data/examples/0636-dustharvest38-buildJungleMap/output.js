function buildJungleMap() {
  if (_jungleMapBuilt) return;
  _jungleMapBuilt = true;
  jungleMap.fill(JG.GRASS);

  // ── Water — north edge ────────────────────────────────────────────────────
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < JG_W; x++)
      setJGT(x, y, y < 4 ? JG.WATER_DEEP : JG.WATER);

  // ── Eastern Dock — x:30–50, y:7–14 ───────────────────────────────────────
  for (let y = 7; y <= 14; y++)
    for (let x = 30; x <= 50; x++)
      setJGT(x, y, JG.DOCK);
  for (let y = 14; y <= 16; y++) {
    setJGT(39, y, JG.PLANK); setJGT(40, y, JG.PLANK); setJGT(41, y, JG.PLANK);
  }

  // ── Beach strip y:7–18 ────────────────────────────────────────────────────
  for (let y = 7; y <= 18; y++)
    for (let x = 0; x < JG_W; x++)
      if (getJGT(x, y) !== JG.DOCK && getJGT(x, y) !== JG.PLANK &&
          getJGT(x, y) !== JG.WATER && getJGT(x, y) !== JG.WATER_DEEP)
        setJGT(x, y, JG.SAND);

  // ── Hard map border — solid walls all 4 edges ─────────────────────────────
  for (let x = 0; x < JG_W; x++) {
    setJGT(x, 0,        JG.WATER_DEEP);
    setJGT(x, JG_H - 1, JG.DENSE_TREE);
  }
  for (let y = 0; y < JG_H; y++) {
    setJGT(0,        y, y < 7 ? JG.WATER_DEEP : JG.DENSE_TREE);
    setJGT(JG_W - 1, y, y < 7 ? JG.WATER_DEEP : JG.DENSE_TREE);
  }
  // Extend solid border 2 tiles deep on left/right so player can't slip into the gap
  for (let y = 7; y < JG_H; y++) {
    setJGT(1, y, y <= 18 ? JG.WATER : JG.DENSE_TREE);
    setJGT(2, y, y <= 18 ? JG.WATER : JG.DENSE_TREE);
    setJGT(JG_W - 2, y, y <= 18 ? JG.WATER : JG.DENSE_TREE);
    setJGT(JG_W - 3, y, y <= 18 ? JG.WATER : JG.DENSE_TREE);
  }
  // Solid strip at y:18→19 transition to seal beach/fringe seam
  for (let x = 0; x < JG_W; x++) {
    if (getJGT(x, 19) !== JG.DOCK && getJGT(x, 19) !== JG.PLANK)
      setJGT(x, 18, getJGT(x, 18) === JG.SAND && x < 4 ? JG.WATER : getJGT(x, 18));
  }

  // ── Road from dock south through village to cleared zone and Entry ─────────
  for (let y = 15; y <= JG_H - 2; y++) {
    setJGT(39, y, JG.ROAD); setJGT(40, y, JG.ROAD);
  }
  // DESCEND tiles at south end of road
  setJGT(39, JG_H - 2, JG.DESCEND);
  setJGT(40, JG_H - 2, JG.DESCEND);
  setJGT(41, JG_H - 2, JG.DESCEND);

  // ── Village clearing — y:26–45, x:28–54 ───────────────────────────────────
  for (let y = 26; y <= 45; y++)
    for (let x = 28; x <= 54; x++)
      setJGT(x, y, JG.JUNGLE_FLOOR);
  setJGT(40, 36, JG.CAMPFIRE);

  // ── The Cleared Zone — y:46–64, x:20–60 ───────────────────────────────────
  for (let y = 46; y <= 64; y++)
    for (let x = 20; x <= 60; x++)
      setJGT(x, y, JG.MUD);

  // ── Jungle fringe scatter — y:19 to JG_H-5 ────────────────────────────────
  // nearEdge band is now 5 tiles (was 4) to match the 2-tile solid border above
  for (let y = 19; y < JG_H - 1; y++) {
    for (let x = 1; x < JG_W - 1; x++) {
      const t = getJGT(x, y);
      if (t === JG.GRASS) {
        // nearEdge: 5-tile solid border so it aligns with the 2-tile hard border above
        const nearEdge = x < 6 || x >= JG_W - 6 || y >= JG_H - 5;
        const mid      = x > 5 && x < JG_W - 5 && y > 19 && y < JG_H - 4;
        if (nearEdge) {
          setJGT(x, y, JG.DENSE_TREE);
        } else if (mid) {
          const h = ((x * 7919 + y * 6271) & 0xFFFF) / 65535;
          if (h < 0.35) setJGT(x, y, JG.TREE);
          else if (h < 0.45) setJGT(x, y, JG.BUSH);
        }
      }
    }
  }

  // ── South road corridor — clear path to DESCEND ───────────────────────────
  for (let y = JG_H - 6; y < JG_H - 1; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = 40 + dx;
      if (x < 1 || x >= JG_W - 1) continue;
      if (getJGT(x, y) !== JG.DESCEND) setJGT(x, y, JG.JUNGLE_FLOOR);
    }
  }

  // ── Ruins facade — surface indicator only (x:10-18, y:65-66) ─────────────
  // Full ruins are a separate zone. The surface shows a visible stone gateway.
  for (let x = 10; x <= 18; x++) {
    setJGT(x, 65, JG.WALL);   // top facade wall
    setJGT(x, 66, JG.FLOOR);  // gateway floor
  }
  setJGT(13, 65, JG.FLOOR); setJGT(14, 65, JG.FLOOR); // gateway arch opening
  setJGT(13, 64, JG.FLOOR); setJGT(14, 64, JG.FLOOR); // approach path
  // Path from facade to central corridor
  for (let x = 15; x <= 37; x++) setJGT(x, 65, JG.GRASS);
  for (let x = 15; x <= 37; x++) setJGT(x, 66, JG.GRASS);

  // ── Ruins entry trigger tile ───────────────────────────────────────────────
  setJGT(13, 65, JG.EXIT); // reuse EXIT tile as "enter ruins" visual cue
  setJGT(14, 65, JG.EXIT);

  // ── Exit tile (return west) ────────────────────────────────────────────────
  setJGT(40, 0, JG.EXIT); setJGT(41, 0, JG.EXIT);
}