function buildDeepJungleMap() {
  if (_deepMapBuilt) return;
  _deepMapBuilt = true;
  deepJungleMap.fill(JG.JUNGLE_FLOOR);

  // ── Canopy transition zone y:0–12 ─────────────────────────────────────────
  // Dense, packed, minimal pathways — the world narrows
  for (let y = 0; y <= 12; y++) {
    for (let x = 0; x < DJ_W; x++) {
      const h = ((x * 7919 + y * 6271 + 17) & 0xFFFF) / 65535;
      const edgePressure = Math.min(x, DJ_W - 1 - x, y) / 8;
      const density = 0.72 - edgePressure * 0.15;
      if (h < density) setDJT(x, y, h < density * 0.4 ? JG.DENSE_TREE : JG.TREE);
      else if (h < density + 0.1) setDJT(x, y, JG.VINE);
    }
  }
  // Entry corridor — carved path from ascend tile
  for (let y = 0; y <= 8; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      setDJT(40 + dx, y, JG.JUNGLE_FLOOR);
    }
  }
  // Ascend tile — return to surface
  setDJT(40, 0, JG.ASCEND); setDJT(41, 0, JG.ASCEND);

  // ── Mid jungle y:13–35 ────────────────────────────────────────────────────
  // Clearings connected by root-lined paths, dark water pools, vine curtains
  for (let y = 13; y <= 35; y++) {
    for (let x = 0; x < DJ_W; x++) {
      const h = ((x * 6271 + y * 5003 + 37) & 0xFFFF) / 65535;
      const h2= ((x * 4999 + y * 7193 + 71) & 0xFFFF) / 65535;
      const edgeX = Math.min(x, DJ_W - 1 - x);
      const baseDensity = 0.48 - edgeX * 0.008;

      if (h < baseDensity * 0.5) setDJT(x, y, JG.DENSE_TREE);
      else if (h < baseDensity) setDJT(x, y, JG.TREE);
      else if (h < baseDensity + 0.06) setDJT(x, y, JG.VINE);
      else if (h2 < 0.06) setDJT(x, y, JG.ROOT);
      else if (h2 < 0.09) setDJT(x, y, JG.MOSS);
      else if (h2 < 0.12 && edgeX > 10) setDJT(x, y, JG.DARK_WATER);
    }
  }

  // Clearings — open spaces where light breaks through
  const clearings = [
    { cx:22, cy:18, r:7 }, { cx:58, cy:22, r:6 }, { cx:40, cy:28, r:8 },
    { cx:15, cy:30, r:5 }, { cx:65, cy:32, r:7 },
  ];
  for (const cl of clearings) {
    for (let dy = -cl.r; dy <= cl.r; dy++) {
      for (let dx = -cl.r; dx <= cl.r; dx++) {
        if (dx * dx + dy * dy > cl.r * cl.r) continue;
        const x = cl.cx + dx, y = cl.cy + dy;
        if (x < 1 || x >= DJ_W - 1 || y < 13 || y > 35) continue;
        const dist = Math.sqrt(dx*dx+dy*dy) / cl.r;
        if (dist < 0.4) setDJT(x, y, JG.CANOPY_BREAK);
        else if (dist < 0.7) setDJT(x, y, JG.MOSS);
        else setDJT(x, y, JG.JUNGLE_FLOOR);
      }
    }
  }

  // Root paths connecting clearings
  const rootPaths = [
    [[22,18],[40,28]], [[40,28],[58,22]], [[40,28],[15,30]], [[40,28],[65,32]]
  ];
  for (const [[x0,y0],[x1,y1]] of rootPaths) {
    let [px,py] = [x0, y0];
    while (Math.abs(px-x1)+Math.abs(py-y1) > 1) {
      setDJT(px, py, JG.ROOT);
      const dx = Math.sign(x1-px) + (Math.random()<0.3?Math.sign(Math.random()-.5):0);
      const dy = Math.sign(y1-py);
      px = Math.max(1,Math.min(DJ_W-2, px+dx));
      py = Math.min(DJ_H-1, py+dy);
    }
  }

  // Main path south
  for (let y = 8; y <= 35; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (getDJT(40+dx, y) !== JG.DARK_WATER) setDJT(40+dx, y, JG.JUNGLE_FLOOR);
    }
  }

  // ── Deep zone y:36–55 ────────────────────────────────────────────────────
  // Darkness broken only by bioluminescence. The formation runs through here.
  for (let y = 36; y <= 55; y++) {
    for (let x = 0; x < DJ_W; x++) {
      const h  = ((x * 5003 + y * 7919 + 113) & 0xFFFF) / 65535;
      const h2 = ((x * 6571 + y * 4327 + 89) & 0xFFFF) / 65535;
      const h3 = ((x * 3719 + y * 8191 + 53) & 0xFFFF) / 65535;
      const edgeX = Math.min(x, DJ_W - 1 - x);

      if (h < 0.55) setDJT(x, y, h < 0.3 ? JG.DENSE_TREE : JG.TREE);
      else if (h2 < 0.08) setDJT(x, y, JG.DARK_WATER);
      else if (h3 < 0.12) setDJT(x, y, JG.BIOLUM);
      else if (h3 < 0.18) setDJT(x, y, JG.ROOT);
      else setDJT(x, y, JG.JUNGLE_FLOOR);
    }
  }

  // ── The Formation — diagonal vein y:40→55, x:20→55 ───────────────────────
  // A diagonal seam of glowing mineral crossing the deep zone.
  // Design: the vein runs NW→SE, 3–5 tiles wide, with FORMATION tiles at core
  // and BIOLUM at edges where the mineral bleeds into the ground.
  for (let y = 40; y <= 55; y++) {
    const progress = (y - 40) / 15;
    const cx_vein  = Math.round(20 + progress * 35); // x:20 at y:40 → x:55 at y:55
    const width    = 2 + Math.floor(((cx_vein * 1301 + y * 1103) & 7) / 4); // 2–3

    for (let dx = -width - 2; dx <= width + 2; dx++) {
      const x = cx_vein + dx;
      if (x < 0 || x >= DJ_W) continue;
      const abs = Math.abs(dx);
      if (abs <= width) {
        setDJT(x, y, JG.FORMATION); // core — solid, glowing
      } else {
        setDJT(x, y, JG.BIOLUM); // bleed edge
      }
    }
    // Open path around the formation (one tile gap on each side)
    setDJT(cx_vein - width - 3, y, JG.JUNGLE_FLOOR);
    setDJT(cx_vein + width + 3, y, JG.JUNGLE_FLOOR);
  }

  // Main path continues south into deep zone
  for (let y = 36; y <= 55; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = 40 + dx;
      if (getDJT(x, y) === JG.FORMATION) continue; // don't overwrite formation
      setDJT(x, y, JG.JUNGLE_FLOOR);
    }
  }

  // ── Ancient Court zone — northwest quadrant y:40–55, x:0–18 ────────────
  // Pre-civilisation stonework. Geometric. Wrong-scale for human use.
  // This is where the Verdant Court waits.
  _buildAncientCourtZone();
}