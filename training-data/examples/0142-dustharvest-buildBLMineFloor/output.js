function buildBLMineFloor(floor) {
  const map = blMineFloorMaps[floor];
  map.fill(TL.MINE_WALL);
  function carve(x1,y1,x2,y2) {
    for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) setBLMineT(floor,x,y,TL.MINE_FLOOR);
  }
  if (floor === 0) {
    // Level 1: wide entry level, mostly intact, grid corridors — company built this to last
    carve(4,4,43,43);
    // Support pillars every 8 tiles — regular, engineered
    for (let py=8;py<=40;py+=8) for (let px=8;px<=40;px+=8) {
      setBLMineT(floor,px,py,TL.MINE_WALL); setBLMineT(floor,px+1,py,TL.MINE_WALL);
      setBLMineT(floor,px,py+1,TL.MINE_WALL); setBLMineT(floor,px+1,py+1,TL.MINE_WALL);
    }
    // East/west side tunnels
    carve(2,20,4,24); carve(44,20,46,24);
  } else if (floor === 1) {
    // Level 2: survey floor, more rooms, equipment bays on east side
    carve(6,6,41,41);
    // Heavier support walls — survey equipment was heavy
    for (let py=10;py<=38;py+=9) for (let px=10;px<=38;px+=9) {
      for (let dy=0;dy<2;dy++) for (let dx=0;dx<2;dx++)
        setBLMineT(floor,px+dx,py+dy,TL.MINE_WALL);
    }
    // Side rooms — equipment bays
    carve(2,12,6,18); carve(2,28,6,34); // west bays
    carve(42,12,46,18); carve(42,28,46,34); // east bays
    carve(14,2,20,6); carve(28,2,34,6); // north alcoves
    carve(14,42,20,46); carve(28,42,34,46); // south alcoves
  } else if (floor === 2) {
    // Level 3: The Crack — geological instability, walls partially collapsed
    // Irregular corridors, some blocked-off sections
    carve(8,8,39,39);
    carve(2,18,8,22); carve(40,18,45,22);
    carve(18,2,22,8); carve(18,40,22,45);
    // Original support pillars — some collapsed (irregular)
    const crackedPillars=[[12,12,20,18],[24,12,36,20],[12,22,18,35],[24,22,36,35]];
    for (const [x1,y1,x2,y2] of crackedPillars)
      for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) setBLMineT(floor,x,y,TL.MINE_WALL);
    // Break some walls to show collapse
    const breaks=[[15,13],[16,14],[25,14],[26,13],[13,25],[14,26],[25,25],[26,26],[19,32],[20,33]];
    for (const [bx,by] of breaks) setBLMineT(floor,bx,by,TL.MINE_FLOOR);
  } else if (floor === 3) {
    // Level 4: Extraction chamber — where the samples came from
    // Large open central chamber, narrow approach corridors
    carve(16,16,31,31); // central chamber
    carve(11,22,16,25); carve(31,22,36,25); // east-west approaches
    carve(22,11,25,16); carve(22,31,25,36); // north-south approaches
    // Long approach corridors from entry
    carve(9,20,12,27); carve(36,20,39,27);
    carve(20,9,27,12); carve(20,36,27,39);
    // Shaft entrance corridor
    carve(9,20,11,27);
  } else {
    // Floor 4 — The Deep Cut: same narrow layout as The Unmapped
    carve(20,4,26,44);
    carve(4,8,20,12);  carve(26,6,44,10);
    carve(4,20,16,24); carve(30,18,44,22);
    carve(6,32,20,36); carve(28,30,42,34);
    carve(14,40,22,46);carve(24,38,38,43);
    carve(2,8,5,11);   carve(40,6,45,9);
    carve(2,32,7,36);  carve(40,30,45,34);
    carve(20,14,24,20);carve(22,26,26,32);
    const breaks=[[21,15,21,15],[23,19,23,19],[22,27,22,27],[20,35,20,35],[25,10,25,10],[21,38,21,38]];
    for (const [x1,y1,x2,y2] of breaks)
      for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) setBLMineT(floor,x,y,TL.MINE_WALL);
  }
  // Scatter veins
  const cfg = BL_MINE_FLOOR_CFG[floor];
  const nodes = blMineResourceNodes[floor];
  for (let y=1;y<MINE_H-1;y++) {
    for (let x=1;x<MINE_W-1;x++) {
      if (getBLMineT(floor,x,y) !== TL.MINE_FLOOR) continue;
      const adjWall = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny])=>getBLMineT(floor,nx,ny)===TL.MINE_WALL);
      if (!adjWall) continue;
      let r = Math.random();
      for (const vein of cfg.veins) {
        if (r < vein.freq) {
          setBLMineT(floor,x,y,vein.tile);
          nodes[x+','+y] = { x, y, def:vein, depleted:false, respawnDay:0 };
          break;
        }
        r -= vein.freq;
      }
    }
  }
  // Place shafts
  const spawnX=11, spawnY=20;
  setBLMineT(floor, spawnX-1, spawnY, TL.MINE_EXIT);   // exit/ascend
  setBLMineT(floor, spawnX+1, spawnY, TL.MINE_SHAFT_UP);
  if (floor < BL_MINE_FLOORS-1) {
    setBLMineT(floor, 38, 38, TL.MINE_SHAFT_DOWN);
  }
}