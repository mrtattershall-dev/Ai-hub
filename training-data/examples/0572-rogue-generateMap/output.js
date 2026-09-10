function generateMap() {
  G.map=[]; G.sat=[]; G.chasmed={}; G.doored={}; G.genAwake={}; G.ventActive={};
  for(let r=0;r<ROWS;r++){
    G.map.push(new Uint8Array(COLS).fill(T.WALL));
    G.sat.push(new Float32Array(COLS));
  }

  // Place rooms (no overlap, padding 2)
  const rooms=[];
  for(let attempt=0; attempt<60 && rooms.length<7; attempt++){
    const rw=irng(4,7), rh=irng(3,5);
    const rx=irng(1,COLS-rw-2), ry=irng(1,ROWS-rh-2);
    let ok=true;
    for(const rm of rooms)
      if(rx<rm.x+rm.w+2&&rx+rw>rm.x-2&&ry<rm.y+rm.h+2&&ry+rh>rm.y-2){ ok=false; break; }
    if(ok){
      rooms.push({x:rx,y:ry,w:rw,h:rh});
      for(let r=ry;r<ry+rh;r++)
        for(let c=rx;c<rx+rw;c++)
          G.map[r][c]=T.FLOOR;
    }
  }

  // Fallback: guarantee at least 3 rooms
  if(rooms.length<3){
    rooms.length=0;
    const r1={x:2,y:2,w:5,h:4}, r2={x:11,y:3,w:5,h:4}, r3={x:18,y:8,w:5,h:4};
    for(const rm of[r1,r2,r3]){
      rooms.push(rm);
      for(let r=rm.y;r<rm.y+rm.h;r++) for(let c=rm.x;c<rm.x+rm.w;c++) G.map[r][c]=T.FLOOR;
    }
  }

  // Connect rooms with L-corridors (2 tiles wide for easier navigation)
  for(let i=1;i<rooms.length;i++){
    const a=rooms[i-1], b=rooms[i];
    let cx=Math.floor(a.x+a.w/2), cy=Math.floor(a.y+a.h/2);
    const tx=Math.floor(b.x+b.w/2), ty=Math.floor(b.y+b.h/2);
    while(cx!==tx){
      G.map[cy][cx]=T.FLOOR;
      if(cy+1<ROWS) G.map[cy+1][cx]=T.FLOOR; // wide corridor
      cx+=(tx>cx?1:-1);
    }
    while(cy!==ty){
      G.map[cy][cx]=T.FLOOR;
      if(cx+1<COLS) G.map[cy][cx+1]=T.FLOOR;
      cy+=(ty>cy?1:-1);
    }
  }

  // Optional chasm before room 2 (only if there's room)
  if(rooms.length>=3){
    const rm=rooms[2];
    const cx=rm.x-1;
    if(cx>0){
      for(let row=rm.y;row<rm.y+rm.h&&row<ROWS-1;row++)
        if(G.map[row][cx]===T.FLOOR) G.map[row][cx]=T.CHASM;
    }
  }

  // Optional bio-door corridor entry for room 3
  if(rooms.length>=4){
    const rm=rooms[3];
    const dc=Math.floor(rm.x+rm.w/2), dr=rm.y-1;
    if(dr>0 && G.map[dr][dc]===T.FLOOR) G.map[dr][dc]=T.BIODOOR;
  }

  // Exit tile — guaranteed in last room, not in a corner the player spawns at
  const lr=rooms[rooms.length-1];
  const exitR=Math.max(lr.y, Math.min(lr.y+lr.h-2, lr.y+Math.floor(lr.h/2)));
  const exitC=Math.max(lr.x, Math.min(lr.x+lr.w-2, lr.x+lr.w-2));
  G.map[exitR][exitC]=T.EXIT;

  // ── PILLAR 2 SPECIAL TILES ────────────────────────────────────
  // Bio-Generator: awakens when adjacent saturation reaches 70 → spawns enemies
  if(rooms.length>=2){
    const rm=rooms[1];
    const gc=Math.floor(rm.x+rm.w*0.75), gr=Math.floor(rm.y+rm.h*0.5);
    if(gr>=0&&gr<ROWS&&gc>=0&&gc<COLS && G.map[gr][gc]===T.FLOOR)
      G.map[gr][gc]=T.BIO_GEN;
  }

  // Corpse Pit: passive rouge regen when standing on it
  if(rooms.length>=3){
    const rm=rooms[Math.floor(rooms.length/2)];
    const pc2=Math.floor(rm.x+rm.w*0.3), pr2=Math.floor(rm.y+rm.h*0.5);
    if(pr2>=0&&pr2<ROWS&&pc2>=0&&pc2<COLS && G.map[pr2][pc2]===T.FLOOR)
      G.map[pr2][pc2]=T.CORPSE_PIT;
  }

  // Spore Vent: activates at sat>=50, deals AOE drain-tick to nearby enemies
  if(rooms.length>=4){
    const rm=rooms[rooms.length>=5 ? rooms.length-2 : rooms.length-1];
    const sc2=Math.floor(rm.x+rm.w*0.5), sr2=Math.floor(rm.y+rm.h*0.25);
    if(sr2>=0&&sr2<ROWS&&sc2>=0&&sc2<COLS && G.map[sr2][sc2]===T.FLOOR)
      G.map[sr2][sc2]=T.SPORE_VENT;
  }

  G.rooms=rooms;

  // ── FLOOR THEME ────────────────────────────────────────────────
  // Floors 1-3: Sterile Lab | 4-6: Organic Corridors | 7-9: Deep Core | 10: Singularity
  G.theme = G.floor<=3 ? 'lab' : G.floor<=6 ? 'organic' : G.floor<=9 ? 'core' : 'singularity';

  // ── SECRET ROOM (30% chance, floors 2+) ────────────────────────
  G.secretRoom=null;
  if(G.floor>=2 && Math.random()<0.30 && rooms.length>=3){
    // Pick a random interior wall tile adjacent to a floor tile — carve a 3×3 room behind it
    const attempts=40;
    for(let a=0;a<attempts;a++){
      const sc=irng(2,COLS-5), sr=irng(2,ROWS-5);
      if(G.map[sr][sc]!==T.WALL) continue;
      // Must have at least one adjacent floor tile (the "secret" wall)
      let adjFloor=false;
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]])
        if(G.map[sr+dr]&&G.map[sr+dr][sc+dc]===T.FLOOR){ adjFloor=true; break; }
      if(!adjFloor) continue;
      // Carve the 3×3 room into walls
      let ok=true;
      for(let rr=sr-1;rr<=sr+3&&ok;rr++)
        for(let cc=sc;cc<=sc+3&&ok;cc++)
          if(rr<0||rr>=ROWS||cc<0||cc>=COLS) ok=false;
      if(!ok) continue;
      for(let rr=sr;rr<sr+3;rr++)
        for(let cc=sc+1;cc<sc+4;cc++)
          G.map[rr][cc]=T.FLOOR;
      // Place a rouge pool and an elite organ drop marker
      G.map[sr+1][sc+2]=T.CORPSE_PIT;
      G.secretRoom={ x:sc, y:sr, w:3, h:3, entryC:sc, entryR:sr+1 };
      // The entry tile stays WALL — player must saturate it to dissolve in
      G.sat[sr+1][sc]=0; // ensure entry wall starts fresh
      break;
    }
  }

  // Player spawn: centre of room 0
  const sr=rooms[0];
  G.px=(sr.x+Math.floor(sr.w/2))*TILE+TILE/2;
  G.py=(sr.y+Math.floor(sr.h/2))*TILE+TILE/2;
  G.floorTransitioning=false;
}