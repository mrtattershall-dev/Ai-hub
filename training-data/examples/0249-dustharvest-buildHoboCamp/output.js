function buildHoboCamp() {
  // Base — patchy dirt and grass only (no STONE/BUSH in base — those are placed explicitly)
  for(let y=0;y<HC_H;y++) for(let x=0;x<HC_W;x++){
    const n=Math.random();
    setHCT(x,y, n<.55?TL.DIRT:TL.GRASS);
  }

  // Water — creek along north edge (y=2,3) — placed BEFORE path so bridge overwrites
  for(let x=0;x<HC_W;x++) setHCT(x,2,TL.WATER);
  for(let x=0;x<HC_W;x++) setHCT(x,3,TL.WATER);
  // y=0,1 — open dirt approach from portal
  for(let x=0;x<HC_W;x++) setHCT(x,0,TL.DIRT);
  for(let x=0;x<HC_W;x++) setHCT(x,1,TL.DIRT);

  // Main north-south road — runs full height, bridge overwrites creek
  for(let y=0;y<HC_H;y++) for(let x=27;x<32;x++) setHCT(x,y,TL.ROAD);
  // Bridge planks over creek (already road from above, just marking intent)
  setHCT(27,2,TL.ROAD); setHCT(28,2,TL.ROAD); setHCT(29,2,TL.ROAD); setHCT(30,2,TL.ROAD); setHCT(31,2,TL.ROAD);
  setHCT(27,3,TL.ROAD); setHCT(28,3,TL.ROAD); setHCT(29,3,TL.ROAD); setHCT(30,3,TL.ROAD); setHCT(31,3,TL.ROAD);

  // Communal clearing — open dirt, no obstructions
  for(let y=18;y<34;y++) for(let x=20;x<40;x++) setHCT(x,y,TL.DIRT);

  // Central campfire — heart of camp
  setHCT(28,24,TL.CAMPFIRE); setHCT(29,24,TL.CAMPFIRE);
  setHCT(28,25,TL.CAMPFIRE); setHCT(29,25,TL.CAMPFIRE);

  // Shared well — north of campfire, off the road
  setHCT(24,21,TL.WELL); setHCT(25,21,TL.WELL);

  // East-west cross paths to each lean-to — keeps the map navigable
  for(let x=12;x<27;x++) setHCT(x,10,TL.ROAD); // NW lean-to path
  for(let x=32;x<46;x++) setHCT(x,10,TL.ROAD); // NE lean-to path
  for(let x=12;x<20;x++) setHCT(x,29,TL.ROAD); // W lean-to path
  for(let x=40;x<47;x++) setHCT(x,29,TL.ROAD); // E lean-to path

  // ── LEAN-TO A — northwest (railroad worker) ──
  // Floor then walls (3 sides — open south)
  for(let y=6;y<9;y++) for(let x=8;x<14;x++) setHCT(x,y,TL.TOWN_FLOOR);
  for(let x=7;x<15;x++) setHCT(x,5,TL.WALL);
  setHCT(7,5,TL.WALL); setHCT(7,6,TL.WALL); setHCT(7,7,TL.WALL); setHCT(7,8,TL.WALL);
  setHCT(14,5,TL.WALL); setHCT(14,6,TL.WALL); setHCT(14,7,TL.WALL); setHCT(14,8,TL.WALL);
  setHCT(10,9,TL.CRATE);

  // ── LEAN-TO B — northeast (ex-city clerk) ──
  for(let y=6;y<9;y++) for(let x=43;x<49;x++) setHCT(x,y,TL.TOWN_FLOOR);
  for(let x=42;x<50;x++) setHCT(x,5,TL.WALL);
  setHCT(42,5,TL.WALL); setHCT(42,6,TL.WALL); setHCT(42,7,TL.WALL); setHCT(42,8,TL.WALL);
  setHCT(49,5,TL.WALL); setHCT(49,6,TL.WALL); setHCT(49,7,TL.WALL); setHCT(49,8,TL.WALL);
  setHCT(44,9,TL.CRATE); setHCT(47,9,TL.CRATE);

  // ── LEAN-TO C — west (farmer who lost land) ──
  for(let y=27;y<31;y++) for(let x=5;x<11;x++) setHCT(x,y,TL.TOWN_FLOOR);
  for(let x=4;x<12;x++) setHCT(x,26,TL.WALL);
  setHCT(4,26,TL.WALL); setHCT(4,27,TL.WALL); setHCT(4,28,TL.WALL); setHCT(4,29,TL.WALL); setHCT(4,30,TL.WALL);
  setHCT(11,26,TL.WALL); setHCT(11,27,TL.WALL); setHCT(11,28,TL.WALL); setHCT(11,29,TL.WALL); setHCT(11,30,TL.WALL);

  // ── LEAN-TO D — east (doctor) ──
  for(let y=27;y<31;y++) for(let x=46;x<52;x++) setHCT(x,y,TL.TOWN_FLOOR);
  for(let x=45;x<53;x++) setHCT(x,26,TL.WALL);
  setHCT(45,26,TL.WALL); setHCT(45,27,TL.WALL); setHCT(45,28,TL.WALL); setHCT(45,29,TL.WALL); setHCT(45,30,TL.WALL);
  setHCT(52,26,TL.WALL); setHCT(52,27,TL.WALL); setHCT(52,28,TL.WALL); setHCT(52,29,TL.WALL); setHCT(52,30,TL.WALL);
  setHCT(48,31,TL.CRATE);

  // ── LEAN-TO E — south center (Kit, heading to ocean) ──
  for(let y=37;y<40;y++) for(let x=23;x<34;x++) setHCT(x,y,TL.TOWN_FLOOR);
  for(let x=22;x<35;x++) setHCT(x,36,TL.WALL);
  setHCT(22,36,TL.WALL); setHCT(22,37,TL.WALL); setHCT(22,38,TL.WALL); setHCT(22,39,TL.WALL);
  setHCT(34,36,TL.WALL); setHCT(34,37,TL.WALL); setHCT(34,38,TL.WALL); setHCT(34,39,TL.WALL);
  setHCT(24,40,TL.CRATE); setHCT(32,40,TL.CRATE);

  // Scatter fire pits — not on paths
  [[16,15],[41,15],[8,33],[50,33]].forEach(([x,y])=>setHCT(x,y,TL.CAMPFIRE));

  // Trees — edges and corners only, not blocking paths
  [[2,1],[3,4],[55,1],[57,4],[2,42],[56,44],[2,48],[57,40],
   [14,44],[45,44],[18,4],[40,4],[2,22],[56,22]].forEach(([x,y])=>setHCT(x,y,TL.TREE));

  // Rocks — decorative, away from walking areas
  [[5,16],[53,16],[10,46],[48,46]].forEach(([x,y])=>setHCT(x,y,TL.ROCK));

  // Notice board
  setHCT(24,30,TL.CRATE);

  // South exit — last thing set so nothing overwrites it
  for(let y=HC_H-5;y<HC_H;y++) for(let x=26;x<33;x++) setHCT(x,y,TL.ROAD);
  for(let x=26;x<33;x++) setHCT(x,HC_H-1,HC.EXIT);
}