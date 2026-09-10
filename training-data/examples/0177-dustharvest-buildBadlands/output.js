function buildBadlands() {
  const rng = (() => { let s=0xDEAD1337; return ()=>{ s^=s<<13;s^=s>>17;s^=s<<5; return (s>>>0)/0xffffffff; }; })();

  // ── Zone boundaries (x=0 is far west/deep, x=79 is entry/right) ──
  const DEEP_X  = 25; // x < 25  → deep badlands
  const MID_X   = 55; // x < 55  → midlands
  // x >= 55 → entry zone

  // ── Base fill — varies by zone ──
  for(let y=0;y<BL_H;y++) for(let x=0;x<BL_W;x++) {
    const n=rng();
    if (x < DEEP_X) {
      // Deep: mostly ash and redrock, oppressive
      setBLT(x,y, n<.45?BL.ASH : n<.72?BL.REDROCK : n<.88?BL.CRACKED : BL.SKULL_ROCK);
    } else if (x < MID_X) {
      // Mid: cracked/redrock mix
      setBLT(x,y, n<.50?BL.CRACKED : n<.76?BL.REDROCK : BL.DUSTFLOOR);
    } else {
      // Entry: open dustfloor and cracked, easier to traverse
      setBLT(x,y, n<.40?BL.DUSTFLOOR : n<.72?BL.CRACKED : BL.REDROCK);
    }
  }

  // ── Mesa plateaus — denser in deep/mid, sparse in entry ──
  const mesaCount = 18;
  for(let i=0;i<mesaCount;i++) {
    const cx = Math.floor(rng()*rng()*(BL_W-8))+4;
    const cy = 4+Math.floor(rng()*(BL_H-8));
    const rw = cx<DEEP_X ? 4+Math.floor(rng()*7) : 3+Math.floor(rng()*5);
    const rh = 2+Math.floor(rng()*4);
    for(let dy=-rh;dy<=rh;dy++) for(let dx=-rw;dx<=rw;dx++) {
      if(Math.abs(dx)/rw+Math.abs(dy)/rh<1.1) setBLT(cx+dx,cy+dy,BL.MESA);
    }
  }

  // ── Canyon strips — more and longer in deep zone ──
  const canyonCount = 10;
  for(let i=0;i<canyonCount;i++) {
    const cx=2+Math.floor(rng()*(BL_W-4));
    const cy=2+Math.floor(rng()*(BL_H-4));
    const horiz=rng()<.5;
    const len = cx < DEEP_X ? 12+Math.floor(rng()*22) : 6+Math.floor(rng()*14);
    for(let j=0;j<len;j++) {
      if(horiz){ setBLT(cx+j,cy,BL.CANYON); setBLT(cx+j,cy+1,BL.CANYON); }
      else      { setBLT(cx,cy+j,BL.CANYON); setBLT(cx+1,cy+j,BL.CANYON); }
    }
  }

  // ── Skull rock clusters — everywhere in deep, sparse in entry ──
  for(let i=0;i<30;i++) {
    const rx=2+Math.floor(rng()*(BL_W-4)), ry=2+Math.floor(rng()*(BL_H-4));
    if(rx >= MID_X && rng()<.6) continue; // sparse in entry
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
      if(rng()<.65) setBLT(rx+dx,ry+dy,BL.SKULL_ROCK);
  }

  // ── Sulfur patches — mid and entry only ──
  for(let i=0;i<18;i++) {
    const sx=DEEP_X+Math.floor(rng()*(BL_W-DEEP_X-2)), sy=1+Math.floor(rng()*(BL_H-2));
    const r=1+Math.floor(rng()*3);
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) {
      if(dx*dx+dy*dy<=r*r && getBLT(sx+dx,sy+dy)!==BL.MESA && getBLT(sx+dx,sy+dy)!==BL.CANYON)
        setBLT(sx+dx,sy+dy,BL.SULFUR);
    }
  }

  // ── Toxic vents — deep zone only, deal damage on contact ──
  for(let i=0;i<12;i++) {
    const vx=1+Math.floor(rng()*DEEP_X), vy=1+Math.floor(rng()*(BL_H-2));
    if(getBLT(vx,vy)===BL.MESA||getBLT(vx,vy)===BL.CANYON) continue;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++)
      if(rng()<.7 && getBLT(vx+dx,vy+dy)!==BL.MESA) setBLT(vx+dx,vy+dy,BL.TOXIC_VENT);
  }

  // ── Dead wood — entry and mid ──
  for(let i=0;i<24;i++) {
    const tx=DEEP_X+Math.floor(rng()*(BL_W-DEEP_X-2)), ty=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(tx,ty);
    if(t!==BL.MESA&&t!==BL.CANYON) setBLT(tx,ty,BL.DEADWOOD);
  }

  // ── Tumbleweed — entry zone mostly ──
  for(let i=0;i<28;i++) {
    const tx=MID_X+Math.floor(rng()*(BL_W-MID_X-2)), ty=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(tx,ty);
    if(t===BL.CRACKED||t===BL.DUSTFLOOR) setBLT(tx,ty,BL.TUMBLEWEED);
  }

  // ── Bone piles — throughout, denser deep ──
  for(let i=0;i<24;i++) {
    const tx=1+Math.floor(rng()*(BL_W-2)), ty=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(tx,ty);
    if(t!==BL.MESA&&t!==BL.CANYON&&t!==BL.SKULL_ROCK&&t!==BL.TOXIC_VENT) setBLT(tx,ty,BL.BL_BONE);
  }

  // ── Outpost — fixed in mid zone ──
  const ox=Math.floor(BL_W*.42)+Math.floor(rng()*8), oy=Math.floor(BL_H*.35)+Math.floor(rng()*10);
  for(let dy=0;dy<8;dy++) for(let dx=0;dx<8;dx++) setBLT(ox+dx,oy+dy,BL.OUTPOST);
  for(let dx=0;dx<8;dx++){ setBLT(ox+dx,oy,BL.OUTPOST_WALL); setBLT(ox+dx,oy+7,BL.OUTPOST_WALL); }
  for(let dy=0;dy<8;dy++){ setBLT(ox,oy+dy,BL.OUTPOST_WALL); setBLT(ox+7,oy+dy,BL.OUTPOST_WALL); }
  setBLT(ox+3,oy+7,BL.OUTPOST); setBLT(ox+4,oy+7,BL.OUTPOST);
  blFireX=ox+3; blFireY=oy+3;
  blChestX=ox+5; blChestY=oy+1;
  blWantedBoardX=ox+3; blWantedBoardY=oy+8;
  blVendorX=ox+1; blVendorY=oy+3;

  // ── Ruined settlement — deep zone landmark ──
  const sx2=4+Math.floor(rng()*10), sy2=8+Math.floor(rng()*(BL_H-20));
  // Clear a patch first
  for(let dy=-2;dy<=12;dy++) for(let dx=-2;dx<=14;dx++) {
    const tx=sx2+dx, ty=sy2+dy;
    if(tx>=0&&tx<BL_W&&ty>=0&&ty<BL_H) setBLT(tx,ty,BL.ASH);
  }
  // Ruined building shells (partial walls)
  const rooms=[[0,0,6,5],[7,0,5,4],[0,6,4,5],[6,6,6,4]];
  for(const [rx,ry,rw,rh] of rooms) {
    for(let dx=0;dx<rw;dx++){ setBLT(sx2+rx+dx,sy2+ry,BL.SETTLEMENT_WALL); setBLT(sx2+rx+dx,sy2+ry+rh-1,BL.SETTLEMENT_WALL); }
    for(let dy=0;dy<rh;dy++){ setBLT(sx2+rx,sy2+ry+dy,BL.SETTLEMENT_WALL); setBLT(sx2+rx+rw-1,sy2+ry+dy,BL.SETTLEMENT_WALL); }
    for(let dy=1;dy<rh-1;dy++) for(let dx=1;dx<rw-1;dx++) setBLT(sx2+rx+dx,sy2+ry+dy,BL.SETTLEMENT);
  }
  // Break walls for a ruined feel — randomly remove wall tiles
  for(let pass=0;pass<18;pass++) {
    const wx=sx2+Math.floor(rng()*14), wy=sy2+Math.floor(rng()*12);
    if(getBLT(wx,wy)===BL.SETTLEMENT_WALL) setBLT(wx,wy,BL.ASH);
  }
  // Railroad tracks — two parallel rails, east-west through mid zone
  // Narrowed to 2 tiles (y=28, y=30 only). Skip settlement footprint so depot is clean.
  const _depotX1 = sx2 - 2, _depotX2 = sx2 + 14;
  for (let rx = 5; rx < BL_W-2; rx++) {
    const inDepot = rx >= _depotX1 && rx <= _depotX2;
    if (inDepot) continue; // don't run tracks through the depot
    if (getBLT(rx,28)===BL.MESA || getBLT(rx,28)===BL.CANYON) continue;
    setBLT(rx, 28, BL.RAIL_TRACK);
    if (getBLT(rx,30)===BL.MESA || getBLT(rx,30)===BL.CANYON) continue;
    setBLT(rx, 30, BL.RAIL_TRACK);
  }

  // BL Mine entrance — placed just east of the settlement, always reachable
  // sx2+16 puts it outside the settlement footprint (settlement covers sx2 to sx2+12)
  blMineEntranceX = Math.min(BL_W-3, sx2 + 16);
  blMineEntranceY = Math.max(2, Math.min(BL_H-3, sy2 + 2));
  // Clear a small area around entrance
  for (let dy=-1;dy<=2;dy++) for (let dx=-1;dx<=3;dx++) {
    const tx=blMineEntranceX+dx, ty=blMineEntranceY+dy;
    if (tx>=0&&tx<BL_W&&ty>=0&&ty<BL_H) setBLT(tx,ty,BL.ASH);
  }
  setBLT(blMineEntranceX, blMineEntranceY, BL.BL_MINE);
  // Place a skull-rock marker one tile north so it's visible from further away
  if (blMineEntranceY > 2) setBLT(blMineEntranceX, blMineEntranceY-1, BL.SKULL_ROCK);

  // Railroad sign — fixed deep-west position, always there regardless of settlement rng
  setBLT(blRailSignX, blRailSignY, BL.SKULL_ROCK); // visually distinct — weathered post

  // Settlement chest (deep reward)
  blDeepChestX=sx2+3; blDeepChestY=sy2+2;
  // Scatter obsidian near settlement
  for(let i=0;i<3;i++) {
    const ox2=sx2-2+Math.floor(rng()*18), oy2=sy2-2+Math.floor(rng()*16);
    if(getBLT(ox2,oy2)===BL.ASH||getBLT(ox2,oy2)===BL.CRACKED) setBLT(ox2,oy2,BL.BL_OBSIDIAN);
  }

  // ── Ore veins — tiered by zone ──
  // Entry: copper common, no iron/silver/obsidian
  for(let i=0;i<14;i++) {
    const vx=MID_X+Math.floor(rng()*(BL_W-MID_X-2)), vy=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(vx,vy);
    if(t===BL.CRACKED||t===BL.REDROCK||t===BL.DUSTFLOOR) setBLT(vx,vy,BL.BL_COPPER);
  }
  // Mid: copper, iron, some silver
  for(let i=0;i<10;i++) {
    const vx=DEEP_X+Math.floor(rng()*(MID_X-DEEP_X)), vy=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(vx,vy);
    if(t===BL.CRACKED||t===BL.REDROCK) setBLT(vx,vy,rng()<.55?BL.BL_COPPER:BL.BL_IRON);
  }
  for(let i=0;i<6;i++) {
    const vx=DEEP_X+Math.floor(rng()*(MID_X-DEEP_X)), vy=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(vx,vy);
    if(t===BL.CRACKED||t===BL.REDROCK||t===BL.DUSTFLOOR) setBLT(vx,vy,BL.BL_SILVER);
  }
  // Deep: iron, silver, obsidian — no copper
  for(let i=0;i<8;i++) {
    const vx=1+Math.floor(rng()*(DEEP_X-2)), vy=1+Math.floor(rng()*(BL_H-2));
    const t=getBLT(vx,vy);
    if(t===BL.ASH||t===BL.REDROCK||t===BL.CRACKED) setBLT(vx,vy,rng()<.5?BL.BL_IRON:BL.BL_SILVER);
  }
  for(let i=0;i<5;i++) {
    const vx=1+Math.floor(rng()*(DEEP_X-2)), vy=1+Math.floor(rng()*(BL_H-2));
    if(getBLT(vx,vy)!==BL.MESA&&getBLT(vx,vy)!==BL.CANYON) setBLT(vx,vy,BL.BL_OBSIDIAN);
  }

  // ── Entry corridor — guaranteed clear ──
  const entryY = Math.floor(BL_H/2);
  for(let dy=-4;dy<=4;dy++) for(let dx=0;dx<6;dx++) {
    const t=getBLT(BL_W-1-dx,entryY+dy);
    if(t===BL.MESA||t===BL.CANYON||t===BL.OUTPOST_WALL||t===BL.SETTLEMENT_WALL)
      setBLT(BL_W-1-dx,entryY+dy,BL.CRACKED);
  }

  // ── Exit markers ──
  for(let dy=-2;dy<=2;dy++) setBLT(BL_W-1,entryY+dy,BL.BL_EXIT);
  for(let py=BL_H-6;py<BL_H;py++) for(let px=BL_W-6;px<BL_W;px++) setBLT(px,py,BL.CRACKED);
  for(let py=BL_H-3;py<BL_H-1;py++) for(let px=BL_W-3;px<BL_W-1;px++) setBLT(px,py,BL.BL_EXIT);
}