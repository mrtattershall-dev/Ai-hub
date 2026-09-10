function buildMineFloor(floor) {
  const map = mineFloorMaps[floor];
  const cfg = MINE_FLOOR_CFG[floor];
  // Fill all with walls
  map.fill(TL.MINE_WALL);

  function carveRoom(x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        setMineT(floor, x, y, TL.MINE_FLOOR);
  }

  if (floor < 3) {
    // Floors 0-2: standard BSP hub layout
    carveRoom(8, 8, 39, 39);
    carveRoom(2, 18, 8, 22);    carveRoom(40, 18, 45, 22);
    carveRoom(18, 2, 22, 8);    carveRoom(18, 40, 22, 45);
    const walls = [
      [12,12,20,18],[24,12,36,20],[12,22,18,35],[24,22,36,35],
      [14,14,16,16],[26,14,28,16],[14,26,16,28],[26,26,28,28],
    ];
    for (const [x1,y1,x2,y2] of walls) {
      for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) setMineT(floor,x,y,TL.MINE_WALL);
    }
  } else {
    // Floor 4 — The Unmapped: no hub, narrow branching tunnels, feels found not built
    // Main spine — a single winding corridor north to south
    carveRoom(20, 4, 26, 44);
    // Branch arms — asymmetric, unsettling
    carveRoom(4,  8,  20, 12);
    carveRoom(26, 6,  44, 10);
    carveRoom(4,  20, 16, 24);
    carveRoom(30, 18, 44, 22);
    carveRoom(6,  32, 20, 36);
    carveRoom(28, 30, 42, 34);
    carveRoom(14, 40, 22, 46);
    carveRoom(24, 38, 38, 43);
    // Dead ends — rooms that go nowhere
    carveRoom(2,  8,  5,  11);
    carveRoom(40, 6,  45, 9);
    carveRoom(2,  32, 7,  36);
    carveRoom(40, 30, 45, 34);
    // Narrow connectors that feel like cracks, not passages
    carveRoom(20, 14, 24, 20);
    carveRoom(22, 26, 26, 32);
    // Wall back in some tiles to break up the spine — uneven natural feel
    const breaks = [
      [21,15,21,15],[23,19,23,19],[22,27,22,27],[20,35,20,35],
      [25,10,25,10],[21,38,21,38],
    ];
    for (const [x1,y1,x2,y2] of breaks) {
      for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) setMineT(floor,x,y,TL.MINE_WALL);
    }
  }

  // Scatter veins on floor tiles (adjacent to walls, same as before)
  const nodes = mineResourceNodes[floor];
  let singingVeinPlaced = false; // track for hidden shaft placement on floor 2
  const singingPositions = [];   // candidates for hidden shaft on floor 3

  for (let y = 1; y < MINE_H-1; y++) {
    for (let x = 1; x < MINE_W-1; x++) {
      if (getMineT(floor, x, y) !== TL.MINE_FLOOR) continue;
      const adjWall = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny]) => getMineT(floor,nx,ny)===TL.MINE_WALL);
      if (!adjWall) continue;
      let r = Math.random();
      for (const vein of cfg.veins) {
        if (r < vein.freq) {
          // On floor 2 (Floor 3), one SINGING_VEIN hides the shaft — mark it
          if (vein.tile === TL.SINGING_VEIN && floor === 2) {
            if (!singingVeinPlaced) {
              singingPositions.push({x, y});
              singingVeinPlaced = true;
            }
            // Still place it as a singing vein — mining it reveals the shaft
          }
          setMineT(floor, x, y, vein.tile);
          nodes[x+','+y] = { x, y, def: vein, depleted: false, respawnDay: 0,
            hiddenShaft: (vein.tile === TL.SINGING_VEIN && floor === 2 && !singingVeinPlaced) };
          break;
        }
        r -= vein.freq;
      }
    }
  }

  // If no singing vein spawned naturally on floor 2, force one in a reasonable spot
  if (floor === 2 && singingPositions.length === 0) {
    // Place at a fixed deep location
    const fx = 35, fy = 35;
    if (getMineT(floor, fx, fy) === TL.MINE_FLOOR) {
      const def = cfg.veins.find(v => v.tile === TL.SINGING_VEIN);
      if (def) {
        setMineT(floor, fx, fy, TL.SINGING_VEIN);
        nodes[fx+','+fy] = { x:fx, y:fy, def, depleted:false, respawnDay:0, hiddenShaft:true };
        singingPositions.push({x:fx, y:fy});
      }
    }
  }

  // Mark one singing vein on floor 2 as the hidden shaft entry
  if (floor === 2 && singingPositions.length > 0) {
    const chosen = singingPositions[0];
    const key = chosen.x+','+chosen.y;
    if (nodes[key]) nodes[key].hiddenShaft = true;
  }

  // Place shaft/exit tiles
  if (floor === 0) {
    setMineT(0, 9, 20, TL.MINE_EXIT);
    setMineT(0, 38, 38, TL.MINE_SHAFT_DOWN);
  } else if (floor === 1) {
    setMineT(1, 9, 20, TL.MINE_SHAFT_UP);
    setMineT(1, 38, 38, TL.MINE_SHAFT_DOWN);
  } else if (floor === 2) {
    setMineT(2, 9, 20, TL.MINE_SHAFT_UP);
    // NO shaft_down here — floor 4 is hidden under the singing vein
  } else if (floor === 3) {
    // Floor 4: shaft up near the entry arm
    setMineT(3, 23, 5, TL.MINE_SHAFT_UP);
    // No shaft down — floor 5 is for a future update
  }
}