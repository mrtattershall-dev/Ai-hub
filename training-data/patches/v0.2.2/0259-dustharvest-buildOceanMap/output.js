function buildOceanMap() {
  // ── Base: sand beach west, shallow water mid, deep ocean east ─────────────
  for(let y=0;y<OC_H;y++) for(let x=0;x<OC_W;x++) {
    if      (x < 10) setOCT(x,y, OC.SAND);
    else if (x < 20) setOCT(x,y, OC.WATER);
    else             setOCT(x,y, OC.DEEP);
  }

  // ── Sandy grass tufts near top of beach ───────────────────────────────────
  [[1,4],[3,6],[6,3],[8,9],[2,14],[5,20],[7,27],[1,33],[4,40],[2,50],[6,55],[8,60]].forEach(([x,y])=>{
    if(y<OC_H) setOCT(x,y,OC.GRASS);
  });

  // ── Beach rocks (north and south clusters) ────────────────────────────────
  [[3,5],[4,5],[5,7],[2,8],[7,10],[8,11],
   [3,52],[4,52],[6,54],[2,56],[8,57],[7,59]].forEach(([x,y])=>{
    if(y<OC_H) setOCT(x,y,OC.ROCK);
  });

  // ── Shoreline road — sandy track along beach ──────────────────────────────
  for(let y=2;y<OC_H-2;y++) { setOCT(6,y,OC.ROAD); setOCT(7,y,OC.ROAD); }

  // ── West exit ─────────────────────────────────────────────────────────────
  const exitY = Math.floor(OC_H/2);
  for(let y=exitY-2;y<=exitY+2;y++) {
    setOCT(0,y,OC.EXIT);
    setOCT(1,y,OC.ROAD); setOCT(2,y,OC.ROAD);
  }

  // ── Dockmaster's shack — y=8–14, x=1–7 ──────────────────────────────────
  for(let y=9;y<14;y++) for(let x=2;x<7;x++) setOCT(x,y,OC.FLOOR);
  for(let x=1;x<8;x++) { setOCT(x,8,OC.WALL); setOCT(x,14,OC.WALL); }
  setOCT(1,8,OC.WALL); setOCT(1,9,OC.WALL); setOCT(1,10,OC.WALL); setOCT(1,11,OC.WALL); setOCT(1,12,OC.WALL); setOCT(1,13,OC.WALL);
  setOCT(7,8,OC.WALL); setOCT(7,9,OC.WALL); setOCT(7,10,OC.WALL); setOCT(7,11,OC.WALL); setOCT(7,12,OC.WALL); setOCT(7,13,OC.WALL);
  // Door open south — tiles at y=14 already wall except gap
  setOCT(4,14,OC.FLOOR); // doorway
  setOCT(8,10,OC.CRATE); setOCT(8,12,OC.CRATE); // crates outside

  // ── Supply shed — y=20–25, x=1–5 ─────────────────────────────────────────
  for(let y=21;y<25;y++) for(let x=2;x<5;x++) setOCT(x,y,OC.FLOOR);
  for(let x=1;x<6;x++) { setOCT(x,20,OC.WALL); setOCT(x,25,OC.WALL); }
  setOCT(1,20,OC.WALL); setOCT(1,21,OC.WALL); setOCT(1,22,OC.WALL); setOCT(1,23,OC.WALL); setOCT(1,24,OC.WALL);
  setOCT(5,20,OC.WALL); setOCT(5,21,OC.WALL); setOCT(5,22,OC.WALL); setOCT(5,23,OC.WALL); setOCT(5,24,OC.WALL);
  setOCT(3,25,OC.FLOOR); // door gap
  setOCT(3,21,OC.CRATE); setOCT(3,22,OC.CRATE); setOCT(3,23,OC.CRATE); // interior crates

  // ── Beach campfire ────────────────────────────────────────────────────────
  setOCT(4,32,OC.FIRE); setOCT(5,32,OC.FIRE);

  // ── Dock approach path ────────────────────────────────────────────────────
  for(let x=7;x<10;x++) { setOCT(x,36,OC.DOCK); setOCT(x,37,OC.DOCK); setOCT(x,38,OC.DOCK); }

  // ── Main dock — y=33–43, x=9–22 ──────────────────────────────────────────
  for(let y=33;y<44;y++) for(let x=9;x<22;x++) setOCT(x,y,OC.DOCK);
  // Posts along dock edges every 3 tiles
  for(let x=10;x<22;x+=3) {
    setOCT(x,32,OC.POST); setOCT(x,44,OC.POST);
  }
  // Dock crates
  setOCT(11,33,OC.CRATE); setOCT(14,33,OC.CRATE); setOCT(17,33,OC.CRATE);
  // Dock fishing seagrass at far end
  [[20,32],[21,34],[20,43],[21,44],[22,38]].forEach(([x,y])=>setOCT(x,y,OC.SEAGRASS));

  // ── Boat slip — extends dock (boat rendered dynamically, tiles walkable) ──
  // Gangplank y=36–40, x=21–24
  for(let y=36;y<41;y++) setOCT(21,y,OC.GANGPLANK);
  // Boat deck y=34–42, x=22–27 — walkable if you own a boat
  for(let y=34;y<43;y++) for(let x=22;x<28;x++) setOCT(x,y,OC.BOAT_DECK);
  // Boat bow/stern posts
  setOCT(24,33,OC.POST); setOCT(24,43,OC.POST);

  // ── Seagrass in shallows ──────────────────────────────────────────────────
  [[11,20],[12,28],[10,44],[13,50],[14,16],[12,38]].forEach(([x,y])=>setOCT(x,y,OC.SEAGRASS));

  // ── Shipwreck debris north shore ──────────────────────────────────────────
  [[13,5],[14,6],[15,5],[16,7],[12,8]].forEach(([x,y])=>setOCT(x,y,OC.CRATE));
  setOCT(11,5,OC.ROCK); setOCT(17,6,OC.ROCK);

  // ── South beach palms ─────────────────────────────────────────────────────
  [[2,47],[4,51],[1,56],[3,60],[6,58]].forEach(([x,y])=>{ if(y<OC_H) setOCT(x,y,OC.TREE); });
}