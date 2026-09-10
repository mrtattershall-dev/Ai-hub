function buildMap() {
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) {
    const n=Math.random();
    setT(x,y, n<.62?TL.GRASS:n<.76?TL.DIRT:n<.84?TL.FLOWERS:TL.BUSH);
  }
  for(let y=2;y<33;y++) for(let x=2;x<33;x++) setT(x,y,TL.DIRT);
  for(let y=3;y<=11;y++) for(let x=3;x<=11;x++) setT(x,y,TL.DIRT);
  for(let y=3;y<=11;y++) for(let x=13;x<=21;x++) setT(x,y,TL.DIRT);
  for(let y=13;y<=21;y++) for(let x=3;x<=11;x++) setT(x,y,TL.DIRT);
  // NEW PATCHES — D, E, F (triples farmable land)
  for(let y=13;y<=21;y++) for(let x=13;x<=21;x++) setT(x,y,TL.DIRT); // D: bottom-centre
  for(let y=3;y<=11;y++) for(let x=23;x<=31;x++) setT(x,y,TL.DIRT);  // E: top-right
  for(let y=13;y<=21;y++) for(let x=23;x<=31;x++) setT(x,y,TL.DIRT); // F: bottom-right
  // Path dividers for new patches
  for(let y=3;y<=21;y++) setT(12,y,TL.DIRT);  // col divider A/B and C/D
  for(let y=3;y<=21;y++) setT(22,y,TL.DIRT);  // col divider E/F from B/D
  for(let x=3;x<=31;x++) setT(x,12,TL.DIRT);  // row divider top/bottom
  for(let y=24;y<30;y++) for(let x=3;x<10;x++) setT(x,y,TL.TOWN_FLOOR);
  for(let y=24;y<30;y++){ setT(2,y,TL.WALL); setT(10,y,TL.WALL); }
  for(let x=2;x<11;x++){ setT(x,23,TL.WALL); setT(x,30,TL.WALL); }
  setT(WELL_TX, WELL_TY, TL.WELL); setT(WELL_TX+1, WELL_TY, TL.WELL);
  setT(16,25,TL.CRATE); setT(17,25,TL.CRATE);
  setT(26,26,TL.WORKBENCH); // Crafting workbench — bottom-right farm corner
  setT(FORGE_TX, FORGE_TY, TL.FORGE);         // Smelting forge — 3 tiles east of workbench
  setT(CAMPFIRE_TX, CAMPFIRE_TY, TL.CAMPFIRE); // Cooking campfire — northeast farm corner
  for(let x=1;x<34;x++){ setT(x,1,TL.FENCE); setT(x,33,TL.FENCE); }
  for(let y=1;y<34;y++){ setT(1,y,TL.FENCE); setT(33,y,TL.FENCE); }
  setT(17,33,TL.ROAD); setT(17,34,TL.ROAD);
  for(let y=2;y<34;y++) for(let x=46;x<76;x++) setT(x,y,TL.TOWN_FLOOR);
  // Fix: fill the east edge strip (x=76-79, north half) with grass so random
  // BUSH/STONE from the initial fill don't create an invisible east wall
  for(let y=0;y<36;y++) for(let x=76;x<MAP_W;x++) setT(x,y,TL.GRASS);
  for(let y=4;y<12;y++) for(let x=48;x<60;x++) setT(x,y,TL.TOWN_FLOOR);
  for(let y=4;y<12;y++){ setT(47,y,TL.WALL); setT(60,y,TL.WALL); }
  for(let x=47;x<61;x++){ setT(x,3,TL.WALL); setT(x,12,TL.WALL); }
  setT(53,12,TL.TOWN_FLOOR); setT(54,12,TL.TOWN_FLOOR);
  for(let y=16;y<24;y++) for(let x=62;x<72;x++) setT(x,y,TL.TOWN_FLOOR);
  for(let y=16;y<24;y++){ setT(61,y,TL.WALL); setT(72,y,TL.WALL); }
  for(let x=61;x<73;x++){ setT(x,15,TL.WALL); setT(x,24,TL.WALL); }
  setT(66,24,TL.TOWN_FLOOR);
  setT(33,17,TL.ROAD); // cut gap in east farm fence at road crossing
  for(let x=34;x<46;x++) setT(x,17,TL.ROAD);
  for(let y=17;y<34;y++) setT(17,y,TL.ROAD);
  for(let y=36;y<76;y++) for(let x=0;x<MAP_W;x++) {
    const n=Math.random();
    setT(x,y, n<.3?TL.STONE:n<.5?TL.DIRT:n<.65?TL.SAND:TL.GRASS);
  }
  for(let i=0;i<80;i++){ const wx=2+Math.floor(Math.random()*(MAP_W-4)),wy=38+Math.floor(Math.random()*34); setT(wx,wy,TL.TREE); }
  for(let i=0;i<60;i++){ const wx=2+Math.floor(Math.random()*(MAP_W-4)),wy=38+Math.floor(Math.random()*34); if(getT(wx,wy)!==TL.TREE) setT(wx,wy,TL.ROCK); }
  for(let y=58;y<76;y++) for(let x=58;x<78;x++) setT(x,y,TL.STONE);
  for(let y=60;y<74;y++) for(let x=60;x<76;x++) setT(x,y,TL.DIRT);
  setT(68,58,TL.MINE);
  // Badlands portal placed AFTER terrain gen below so it isn't overwritten
  for(let x=0;x<MAP_W;x++){ setT(x,34,TL.WATER); setT(x,35,TL.WATER); }
  setT(17,34,TL.ROAD); setT(17,35,TL.ROAD);
  setT(50,34,TL.ROAD); setT(50,35,TL.ROAD);

  // Fishing spots — small docks along the south bank (y=33)
  // West dock near farm road
  for(let x=10;x<14;x++) setT(x,33,TL.SAND);
  setT(11,33,TL.FISHING_SPOT); setT(12,33,TL.FISHING_SPOT);
  // Central dock
  for(let x=30;x<35;x++) setT(x,33,TL.SAND);
  setT(31,33,TL.FISHING_SPOT); setT(32,33,TL.FISHING_SPOT); setT(33,33,TL.FISHING_SPOT);
  // East dock near town
  for(let x=55;x<60;x++) setT(x,33,TL.SAND);
  setT(56,33,TL.FISHING_SPOT); setT(57,33,TL.FISHING_SPOT);

  // ── Stream D: Barn Zone (SW quadrant, y36–y70, x0–x33) ──────────────
  // Clear barn zone from random wilderness fill — flat grazing ground
  for(let y=RANCH_ZONE_Y_MIN;y<RANCH_ZONE_Y_MAX;y++) for(let x=0;x<RANCH_ZONE_X_MAX;x++) {
    const n=Math.random();
    setT(x,y, n<.7?TL.GRASS:n<.85?TL.DIRT:TL.FLOWERS);
  }
  // Dirt road divider across top of barn zone
  for(let x=0;x<34;x++) setT(x,36,TL.DIRT);
  // Wide grazing field (open pen_floor area)
  for(let y=56;y<70;y++) for(let x=3;x<30;x++) setT(x,y,TL.PEN_FLOOR);

  // Barn structure at x16,y50 — 4 wide x 5 tall
  for(let y=50;y<55;y++) for(let x=16;x<20;x++) setT(x,y,TL.BARN_CLOSED);
  // Barn door — south face center, starts closed
  setT(BARN_TX, BARN_TY, TL.BARN_CLOSED); setT(BARN_TX+1, BARN_TY, TL.BARN_CLOSED);

  // Feed storage crate next to barn
  setT(14,51,TL.CRATE); setT(14,52,TL.CRATE);

  // Ranch well at RANCH_WELL_TX, RANCH_WELL_TY
  setT(RANCH_WELL_TX, RANCH_WELL_TY, TL.WELL); setT(RANCH_WELL_TX+1, RANCH_WELL_TY, TL.WELL);

  // Starter chicken pen at x7,y43 — w:4, h:5 (x7-10, y43-47)
  for(let x=7;x<11;x++){ setT(x,43,TL.FENCE); setT(x,47,TL.FENCE); }
  for(let y=43;y<48;y++){ setT(7,y,TL.FENCE); setT(10,y,TL.FENCE); }
  for(let y=44;y<47;y++) for(let x=8;x<10;x++) setT(x,y,TL.DIRT);
  setT(9,47,TL.FENCE_GATE); // south gate

  // Legacy backup trough near barn
  setT(LEGACY_TROUGH_TX, LEGACY_TROUGH_TY, TL.FEED_TROUGH);

  // Badlands portal — bottom-left corner, easy to find
  // Clear a small 3×3 dirt clearing first so it stands out
  for(let dy=0;dy<3;dy++) for(let dx=0;dx<5;dx++) setT(2+dx,74+dy,TL.DIRT);
  setT(3,75,TL.BADLANDS_PORTAL);
  setT(4,75,TL.BADLANDS_PORTAL);

  // Hobo Camp portal — north town sector, above market building
  // Dirt path at y=0-1, portal at y=2 in the town floor
  for(let x=49;x<54;x++){ setT(x,0,TL.ROAD); setT(x,1,TL.ROAD); }
  setT(50,2,TL.HOBO_PORTAL);
  setT(51,2,TL.HOBO_PORTAL);
  setT(52,2,TL.HOBO_PORTAL);

  // Ocean portal — east edge of map, sandy approach y=34-38
  for(let y=33;y<40;y++) setT(78,y,TL.SAND);
  for(let y=33;y<40;y++) setT(79,y,TL.SAND);
  setT(79,35,TL.OCEAN_PORTAL);
  setT(79,36,TL.OCEAN_PORTAL);
  setT(79,37,TL.OCEAN_PORTAL);
}