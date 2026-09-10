function drawTile(tx,ty,sx,sy) {
  const t=getT(tx,ty), c=TC[t]||TC[TL.GRASS];
  ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);

  // Shared helpers
  const seed=tx*7+ty*13;
  const r=(n,m)=>((n*2654435761)>>>0)%m; // fast deterministic hash

  if(t===TL.GRASS){
    const G0='#292129',G1='#426848',G2='#647645',G3='#a8ab5c',G4='#e3f19e';
    ctx.fillStyle=G2; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle=G3; ctx.fillRect(sx,sy,T,3);        // sun hitting ground plane
    ctx.fillStyle=G1; ctx.fillRect(sx,sy+T-4,T,4);   // shadow bottom
    const g=seed;
    // Blade cluster A — 4-color blade
    const ax=sx+r(g,20)+2, ay=sy+r(g*3,14)+5;
    ctx.fillStyle=G0; ctx.fillRect(ax,ay+4,1,3);
    ctx.fillStyle=G1; ctx.fillRect(ax,ay+2,1,3);
    ctx.fillStyle=G3; ctx.fillRect(ax,ay,1,3);
    ctx.fillStyle=G4; ctx.fillRect(ax,ay-1,1,1);
    // Blade cluster B
    const bx=sx+r(g*5,18)+8, by=sy+r(g*7,12)+7;
    ctx.fillStyle=G0; ctx.fillRect(bx,by+5,1,3);
    ctx.fillStyle=G1; ctx.fillRect(bx,by+3,1,3);
    ctx.fillStyle=G3; ctx.fillRect(bx,by+1,1,2);
    ctx.fillStyle=G4; ctx.fillRect(bx,by,1,2);
    // Blade cluster C
    const cx2=sx+r(g*11,14)+13, cy2=sy+r(g*13,10)+8;
    ctx.fillStyle=G1; ctx.fillRect(cx2,cy2+3,1,3);
    ctx.fillStyle=G3; ctx.fillRect(cx2,cy2+1,1,3);
    ctx.fillStyle=G4; ctx.fillRect(cx2,cy2,1,1);
    // Dirt patch
    if(g%7===0){
      ctx.fillStyle='#7a6251'; ctx.fillRect(sx+r(g*23,12)+4,sy+r(g*29,10)+10,6,3);
      ctx.fillStyle='#a38762'; ctx.fillRect(sx+r(g*23,12)+4,sy+r(g*29,10)+10,6,1);
      ctx.fillStyle=G0;        ctx.fillRect(sx+r(g*23,12)+4,sy+r(g*29,10)+12,6,1);
    }
  }
  else if(t===TL.FARM_DRY){
    ctx.fillStyle='#7a6251'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#a38762'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy+T-2,T,2);
    ctx.fillStyle='#292129';
    ctx.fillRect(sx+2,sy+7,T-4,1); ctx.fillRect(sx+2,sy+16,T-4,1); ctx.fillRect(sx+2,sy+23,T-4,1);
    ctx.fillRect(sx+11,sy+2,1,T-4);
    ctx.fillStyle='#a38762';
    ctx.fillRect(sx+2,sy+8,T-4,1); ctx.fillRect(sx+2,sy+17,T-4,1);
  }
  else if(t===TL.FARM_TILLED){
    ctx.fillStyle='#423734'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy,T,1);
    for(let i=0;i<3;i++){
      ctx.fillStyle='#292129'; ctx.fillRect(sx+2,sy+5+i*9,T-4,3);
      ctx.fillStyle='#7a6251'; ctx.fillRect(sx+2,sy+5+i*9,T-4,1);
      ctx.fillStyle='#544b46'; ctx.fillRect(sx+2,sy+6+i*9,T-4,1);
    }
  }
  else if(t===TL.FARM_WATERED){
    ctx.fillStyle='#382f2c'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#423734'; ctx.fillRect(sx,sy,T,1);
    for(let i=0;i<3;i++){
      ctx.fillStyle='#292129'; ctx.fillRect(sx+2,sy+5+i*9,T-4,3);
      ctx.fillStyle='#544b46'; ctx.fillRect(sx+2,sy+5+i*9,T-4,1);
      ctx.fillStyle='#3a3530'; ctx.fillRect(sx+2,sy+6+i*9,T-4,1);
    }
    ctx.fillStyle='rgba(0,42,82,.2)'; ctx.fillRect(sx,sy,T,T);
  }
  else if(t===TL.TREE){
    const TRK=['#292129','#5b4b41','#897762','#cfc7b2'];
    const CAN=['#292129','#276b1f','#57973b','#a8c85c','#e3f19e'];
    ctx.fillStyle='#647645'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#426848'; ctx.fillRect(sx,sy+T-4,T,4);
    // Trunk — 4-color
    ctx.fillStyle=TRK[0]; ctx.fillRect(sx+T/2-3,sy+T/2-1,7,T/2+3);
    ctx.fillStyle=TRK[1]; ctx.fillRect(sx+T/2-2,sy+T/2,  5,T/2+2);
    ctx.fillStyle=TRK[3]; ctx.fillRect(sx+T/2-2,sy+T/2,  2,T/2+1);
    ctx.fillStyle=TRK[2]; ctx.fillRect(sx+T/2,  sy+T/2,  3,T/2+1);
    // Root flare
    ctx.fillStyle=TRK[0];
    ctx.fillRect(sx+T/2-5,sy+T-5,3,5); ctx.fillRect(sx+T/2+3,sy+T-5,4,5);
    ctx.fillStyle=TRK[1];
    ctx.fillRect(sx+T/2-4,sy+T-4,2,4); ctx.fillRect(sx+T/2+3,sy+T-4,3,4);
    // Canopy — 5 layers: outline → deep → mid → light → specular
    ctx.fillStyle=CAN[0];
    ctx.beginPath(); ctx.ellipse(sx+T/2,  sy+T/2-5,13,11,0,   0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2-7,sy+T/2-8,9, 8,-0.3, 0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2+7,sy+T/2-6,8, 7, 0.3, 0,Math.PI*2); ctx.fill();
    ctx.fillStyle=CAN[1];
    ctx.beginPath(); ctx.ellipse(sx+T/2,  sy+T/2-5,11,9,0,    0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2-6,sy+T/2-8,7, 6,-0.3, 0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2+6,sy+T/2-6,6, 5, 0.3, 0,Math.PI*2); ctx.fill();
    ctx.fillStyle=CAN[2];
    ctx.beginPath(); ctx.ellipse(sx+T/2-1,sy+T/2-6,9, 8,0,    0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2-5,sy+T/2-9,5, 4,-0.3, 0,Math.PI*2); ctx.fill();
    ctx.fillStyle=CAN[3];
    ctx.beginPath(); ctx.ellipse(sx+T/2-3,sy+T/2-9,7, 6,0,    0,Math.PI*2); ctx.fill();
    ctx.fillStyle=CAN[4];
    ctx.beginPath(); ctx.ellipse(sx+T/2-5,sy+T/2-11,4,3,0,    0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2-2,sy+T/2-12,2,1,0,    0,Math.PI*2); ctx.fill();
    // Dead branch
    ctx.strokeStyle=TRK[0]; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(sx+T/2+4,sy+T/2-11); ctx.lineTo(sx+T/2+11,sy+T/2-16); ctx.stroke();
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+T/2+9,sy+T/2-14); ctx.lineTo(sx+T/2+13,sy+T/2-12); ctx.stroke();
  }
  else if(t===TL.WATER){
    // Mana Seed water — exact pixel frames from summer water sparkles B sheet
    // Base: #246fa6, sparse pixel overlay cycles through 4 frames
    // Colors: 1=#246fa6(dark) 2=#49a3cb(mid) 3=#92d2f0(bright)
    const WC=['','#246fa6','#49a3cb','#92d2f0'];
    const BASE='#246fa6', DEEP='#384e86', FOAM='rgba(223,252,253,.25)';

    // Fill base
    ctx.fillStyle=BASE; ctx.fillRect(sx,sy,T,T);
    // Depth — darker bottom strip
    ctx.fillStyle=DEEP; ctx.fillRect(sx,sy+T-6,T,6);

    // Pixel frames — each [px,py,colorIdx] is one sparkle pixel in the 16x16 cell
    // Tiled: since T=32 and cell=16, draw the pattern twice (2x2 tiling per tile)
    const FRAMES=[
      [[1,1,3],[2,1,2],[7,3,3],[11,3,2],[12,3,2],[6,5,2],[13,5,2],[14,5,3],[2,6,2],[3,6,2],[4,8,3],[5,8,2],[9,9,3],[2,11,2],[3,11,2],[13,11,3],[5,13,3],[14,13,2],[0,14,3],[1,14,2],[10,14,2],[11,14,2]],
      [[1,1,2],[2,1,3],[7,3,2],[11,3,2],[12,3,3],[6,5,3],[13,5,2],[14,5,2],[2,6,2],[3,6,3],[4,8,2],[5,8,3],[9,9,2],[10,9,3],[2,11,3],[3,11,2],[13,11,2],[5,13,2],[14,13,3],[0,14,2],[1,14,2],[10,14,2],[11,14,3]],
      [[1,1,2],[2,1,2],[7,3,2],[11,3,3],[12,3,2],[6,5,2],[13,5,3],[14,5,2],[2,6,3],[3,6,2],[4,8,2],[5,8,2],[9,9,2],[10,9,2],[2,11,2],[3,11,3],[13,11,2],[5,13,2],[14,13,2],[0,14,2],[1,14,3],[10,14,3],[11,14,2]],
      [[1,1,2],[2,1,3],[7,3,2],[11,3,2],[12,3,3],[6,5,3],[13,5,2],[14,5,2],[2,6,2],[3,6,3],[4,8,2],[5,8,3],[9,9,2],[10,9,3],[2,11,3],[3,11,2],[13,11,2],[5,13,2],[14,13,3],[0,14,2],[1,14,2],[10,14,2],[11,14,3]],
    ];
    // Frame index — each tile offset by its position so they don't all animate in sync
    const fi = (Math.floor(Date.now()/320) + tx*3 + ty*5) & 3;
    const frame = FRAMES[fi];
    // Draw 2x2 tiling of the 16x16 pattern to fill the 32x32 tile
    for(const [px,py,ci] of frame){
      ctx.fillStyle=WC[ci];
      ctx.fillRect(sx+px,   sy+py,   1,1);  // top-left quadrant
      ctx.fillRect(sx+px+16,sy+py,   1,1);  // top-right
      ctx.fillRect(sx+px,   sy+py+16,1,1);  // bottom-left
      ctx.fillRect(sx+px+16,sy+py+16,1,1);  // bottom-right
    }
    // Top foam edge
    ctx.fillStyle=FOAM; ctx.fillRect(sx,sy,T,1);
  }
  else if(t===TL.STONE){
    const RK=['#292129','#5b4b41','#897762','#cfc7b2'];
    ctx.fillStyle=RK[1]; ctx.fillRect(sx,sy,T,T);
    // Block courses — offset per row
    const rowOff=(ty%2===0)?0:T/2;
    ctx.fillStyle=RK[2]; ctx.fillRect(sx,sy,T,T/2-1);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(sx,sy+T/2-1,T,2); // deep mortar
    ctx.fillStyle=RK[2]; ctx.fillRect(sx,sy+T/2+1,T,T/2-1);
    // Vertical mortar lines per course
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.fillRect(sx+rowOff%T,sy+1,1,T/2-3);
    ctx.fillRect(sx+(rowOff+T/2)%T,sy+1,1,T/2-3);
    ctx.fillRect(sx+((rowOff+T/4)%T),sy+T/2+2,1,T/2-3);
    ctx.fillRect(sx+((rowOff+3*T/4)%T),sy+T/2+2,1,T/2-3);
    // Surface pitting
    if(seed%5===0){ctx.fillStyle='rgba(30,15,10,.2)';ctx.fillRect(sx+r(seed,18)+3,sy+r(seed*3,12)+3,4,3);}
    // Top highlight
    ctx.fillStyle=RK[3]; ctx.fillRect(sx,sy,T,1); ctx.fillRect(sx,sy+T/2+1,T,1);
    // Bottom shadow
    ctx.fillStyle=RK[0]; ctx.fillRect(sx,sy+T/2-2,T,1); ctx.fillRect(sx,sy+T-2,T,2);
  }
  else if(t===TL.ROCK){
    const RK=['#292129','#5b4b41','#897762','#cfc7b2','#e0e0d0'];
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle=RK[0]; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+2,13,9,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=RK[1]; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+2,11,7,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=RK[2]; ctx.beginPath(); ctx.ellipse(sx+T/2-1,sy+T/2,  9,6,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=RK[3]; ctx.beginPath(); ctx.ellipse(sx+T/2-3,sy+T/2-2,5,3,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=RK[4]; ctx.beginPath(); ctx.ellipse(sx+T/2-4,sy+T/2-3,2,1,0.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=RK[0]; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+T/2-1,sy+T/2+1); ctx.lineTo(sx+T/2+4,sy+T/2+5); ctx.stroke();
    ctx.strokeStyle=RK[3];
    ctx.beginPath(); ctx.moveTo(sx+T/2-1,sy+T/2); ctx.lineTo(sx+T/2+4,sy+T/2+4); ctx.stroke();
  }
  else if(t===TL.ROAD){
    const RD=['#292129','#5b4b41','#897762','#a38762','#cfc7b2'];
    ctx.fillStyle=RD[2]; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle=RD[3]; ctx.fillRect(sx,sy,T,1);
    ctx.fillStyle=RD[0]; ctx.fillRect(sx,sy+T-1,T,1);
    ctx.fillStyle=RD[0]; ctx.fillRect(sx+5,sy,4,T); ctx.fillRect(sx+T-9,sy,4,T);
    ctx.fillStyle=RD[1]; ctx.fillRect(sx+5,sy,3,T); ctx.fillRect(sx+T-9,sy,3,T);
    ctx.fillStyle=RD[2]; ctx.fillRect(sx+5,sy,1,T); ctx.fillRect(sx+T-9,sy,1,T);
    if(seed%8===0){
      ctx.fillStyle=RD[2]; ctx.fillRect(sx+T/2-2,sy+T/2-1,6,4);
      ctx.fillStyle=RD[4]; ctx.fillRect(sx+T/2-2,sy+T/2-1,6,1);
      ctx.fillStyle=RD[0]; ctx.fillRect(sx+T/2-2,sy+T/2+2,6,1);
    }
  }
  else if(t===TL.SAND){
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#d8ba78'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#a07a40'; ctx.fillRect(sx,sy+T-2,T,2);
    if(seed%4===0){ctx.fillStyle='#b89050';ctx.fillRect(sx+r(seed,22)+2,sy+r(seed*5,18)+2,3,2);}
  }
  else if(t===TL.BUILDING){
    ctx.fillStyle='#503520';ctx.fillRect(sx+2,sy+2,T-4,T-4);
    ctx.fillStyle='#180e08';ctx.fillRect(sx+5,sy+5,T-10,T-10);
    if(gameState.isNight){ctx.fillStyle='rgba(255,200,80,.15)';ctx.fillRect(sx+8,sy+8,T-16,T-16);}
  }
  else if(t===TL.FENCE){
    ctx.fillStyle='#786030';
    ctx.fillRect(sx+T/2-2,sy,4,T);
    ctx.fillStyle='#887040'; ctx.fillRect(sx+T/2-2,sy,2,T); // post highlight
    ctx.fillStyle='#584820'; ctx.fillRect(sx+T/2+1,sy,1,T); // post shadow
    // Rails
    ctx.fillStyle='#685828'; ctx.fillRect(sx,sy+6,T,3);
    ctx.fillStyle='#786838'; ctx.fillRect(sx,sy+6,T,1);
    ctx.fillStyle='#685828'; ctx.fillRect(sx,sy+18,T,3);
    ctx.fillStyle='#786838'; ctx.fillRect(sx,sy+18,T,1);
  }
  else if(t===TL.WALL){
    ctx.fillStyle='#3a3228'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#4a4238'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#2a2218'; ctx.fillRect(sx,sy+T-2,T,2);
    // Stone block pattern
    ctx.fillStyle='#2e2620';
    ctx.fillRect(sx+2,sy+T/2,T-4,1);
    if((tx+ty)%2===0){
      ctx.fillRect(sx+T/2,sy+2,1,T/2-1);
    } else {
      ctx.fillRect(sx+4,sy+T/2+1,1,T/2-3);
      ctx.fillRect(sx+T-5,sy+2,1,T/2-1);
    }
    ctx.fillStyle='#4a4238';
    ctx.fillRect(sx+2,sy+T/2-1,T-4,1);
  }
  else if(t===TL.WELL){
    ctx.fillStyle='#706858';ctx.fillRect(sx+6,sy+8,T-12,T-12);
    ctx.fillStyle='#7a7262';ctx.fillRect(sx+6,sy+8,T-12,2);
    ctx.fillStyle='#504848';ctx.fillRect(sx+6,sy+T-4,T-12,2);
    ctx.fillStyle='#1e3458';ctx.fillRect(sx+9,sy+11,T-18,T-18);
    ctx.fillStyle='#283e68';ctx.fillRect(sx+9,sy+11,T-18,2);
    ctx.fillStyle='#808878';ctx.fillRect(sx+4,sy+6,T-8,4);
    ctx.fillStyle='#909888';ctx.fillRect(sx+4,sy+6,T-8,1);
  }
  else if(t===TL.CRATE){
    ctx.fillStyle='#6a4018';ctx.fillRect(sx+3,sy+3,T-6,T-6);
    ctx.fillStyle='#7a5020';ctx.fillRect(sx+3,sy+3,T-6,2);
    ctx.fillStyle='#4a2c0e';ctx.fillRect(sx+3,sy+T-5,T-6,2);
    ctx.strokeStyle='#3a2010';ctx.lineWidth=1;
    ctx.strokeRect(sx+3,sy+3,T-6,T-6);
    ctx.fillStyle='#8a6028';ctx.fillRect(sx+T/2-1,sy+3,2,T-6);
    ctx.fillRect(sx+3,sy+T/2-1,T-6,2);
  }
  else if(t===TL.FORGE){
    ctx.fillStyle='#3a2818';ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#584030';ctx.fillRect(sx+3,sy+3,T-6,T-6);
    ctx.fillStyle='#685040';ctx.fillRect(sx+3,sy+3,T-6,2);
    ctx.fillStyle='#180c08';ctx.fillRect(sx+8,sy+14,T-16,T-20);
    const flicker=0.5+0.5*Math.sin(Date.now()*.008+sx);
    const r2=Math.floor(220+35*flicker), g2=Math.floor(80+60*flicker);
    ctx.fillStyle=`rgb(${r2},${g2},20)`;ctx.fillRect(sx+10,sy+16,T-20,T-24);
    ctx.fillStyle='rgba(255,200,80,.6)';ctx.fillRect(sx+12,sy+18,4,3);ctx.fillRect(sx+T-16,sy+20,3,3);
    ctx.fillStyle='#2a1e18';ctx.fillRect(sx+10,sy,12,7);
    ctx.fillStyle='#1a0e0a';ctx.fillRect(sx+12,sy+1,8,5);
    const sm=Date.now()*.002;
    ctx.fillStyle='rgba(160,140,120,.3)';
    ctx.fillRect(sx+13+(Math.sin(sm)*2|0),sy-4+(Math.sin(sm*.7)*1|0),3,4);
    ctx.fillRect(sx+17+(Math.sin(sm+1)*2|0),sy-7+(Math.sin(sm*.5)*1|0),2,4);
  }
  else if(t===TL.WORKBENCH){
    ctx.fillStyle='#7a5228';ctx.fillRect(sx+2,sy+6,T-4,T-10);
    ctx.fillStyle='#8a6230';ctx.fillRect(sx+2,sy+6,T-4,2);
    ctx.fillStyle='#5a3c18';ctx.fillRect(sx+2,sy+T-4,T-4,2);
    ctx.fillStyle='#5a3818';ctx.fillRect(sx+3,sy+T-8,4,8);ctx.fillRect(sx+T-7,sy+T-8,4,8);
    ctx.fillStyle='#a07838';ctx.fillRect(sx+5,sy+9,T-10,3);
    ctx.fillStyle='#b08840';ctx.fillRect(sx+5,sy+9,T-10,1);
    ctx.font='11px serif';ctx.textAlign='center';ctx.fillText('🪚',sx+T/2,sy+T/2+2);
  }
  else if(t===TL.CAMPFIRE){
    ctx.fillStyle='#484030'; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T*.65,T*.38,T*.22,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#383020'; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T*.65,T*.26,T*.14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#585040'; ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T*.65,T*.38,T*.22,0,0,Math.PI); ctx.fill();
    ctx.strokeStyle='#5a3c18'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(sx+7,sy+T*.74); ctx.lineTo(sx+T-7,sy+T*.56); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+9,sy+T*.56); ctx.lineTo(sx+T-9,sy+T*.74); ctx.stroke();
    if (settings.campfireGlow) {
      const ft=Date.now()*.004+sx;
      const flk=Math.sin(ft)*2.5;
      ctx.fillStyle='rgba(200,50,10,.9)'; ctx.beginPath();
      ctx.moveTo(sx+T/2,sy+T*.22+flk); ctx.lineTo(sx+T/2-7,sy+T*.56); ctx.lineTo(sx+T/2+7,sy+T*.56); ctx.fill();
      ctx.fillStyle='rgba(240,130,10,.85)'; ctx.beginPath();
      ctx.moveTo(sx+T/2,sy+T*.30+flk); ctx.lineTo(sx+T/2-5,sy+T*.55); ctx.lineTo(sx+T/2+5,sy+T*.55); ctx.fill();
      ctx.fillStyle='rgba(255,210,60,.8)'; ctx.beginPath();
      ctx.moveTo(sx+T/2,sy+T*.38+flk); ctx.lineTo(sx+T/2-2,sy+T*.53); ctx.lineTo(sx+T/2+2,sy+T*.53); ctx.fill();
      const sa=0.18+Math.sin(ft*.6)*.08;
      ctx.strokeStyle=`rgba(160,150,130,${sa})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(sx+T/2,sy+T*.20+flk); ctx.quadraticCurveTo(sx+T/2+5,sy+T*.08,sx+T/2-3,sy-2); ctx.stroke();
    } else {
      ctx.fillStyle='rgba(200,80,10,.7)'; ctx.beginPath();
      ctx.moveTo(sx+T/2,sy+T*.30); ctx.lineTo(sx+T/2-5,sy+T*.55); ctx.lineTo(sx+T/2+5,sy+T*.55); ctx.fill();
    }
  }
  else if(t===TL.SPRINKLER){
    ctx.fillStyle='#3a2c14'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#506070';
    ctx.fillRect(sx+T/2-2,sy+6,4,T-12);
    ctx.fillRect(sx+6,sy+T/2-2,T-12,4);
    ctx.fillStyle='#607888'; ctx.fillRect(sx+T/2-2,sy+6,2,T-12); ctx.fillRect(sx+6,sy+T/2-2,T-12,2);
    ctx.fillStyle='#90a0b0';
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T/2,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#b0c0d0'; ctx.beginPath(); ctx.arc(sx+T/2-1,sy+T/2-1,2,0,Math.PI*2); ctx.fill();
    const tips=[[0,-1],[0,1],[-1,0],[1,0]];
    tips.forEach(([dx,dy])=>{
      const ex=sx+T/2+dx*(T/2-5), ey=sy+T/2+dy*(T/2-5);
      ctx.fillStyle='#6a8898'; ctx.beginPath(); ctx.arc(ex,ey,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#90a8b8'; ctx.beginPath(); ctx.arc(ex-dx,ey-dy,2,0,Math.PI*2); ctx.fill();
      const phase=Date.now()*.003+dx*1.3+dy*2.1;
      const dropAlpha=0.4+0.35*Math.sin(phase);
      ctx.globalAlpha=dropAlpha;
      ctx.fillStyle='#50a8d8';
      ctx.beginPath(); ctx.arc(ex+dx*6+Math.sin(phase)*2,ey+dy*6+Math.cos(phase)*2,2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    });
    if(player.tool==='sprinkler'){
      ctx.strokeStyle='rgba(80,168,216,0.22)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.strokeRect(sx-T+2,sy-T+2,T*3-4,T*3-4);ctx.setLineDash([]);
    }
  }
  else if(t===TL.ROAD){
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#8a7c6c'; ctx.fillRect(sx,sy,T,1);
    ctx.fillStyle='#4a3e30'; ctx.fillRect(sx,sy+T-1,T,1);
    ctx.fillStyle='#5a4e3e'; ctx.fillRect(sx+5,sy+1,3,T-2); ctx.fillRect(sx+T-8,sy+1,3,T-2);
    ctx.fillStyle='#7a6e5e'; ctx.fillRect(sx+5,sy+1,1,T-2); ctx.fillRect(sx+T-8,sy+1,1,T-2);
    if(seed%8===0){ctx.fillStyle='#6a5e4e';ctx.fillRect(sx+T/2-2,sy+T/2-1,5,3);}
  }
  else if(t===TL.FLOWERS){
    ctx.fillStyle='#4a6228'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#526a30'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#3a5220'; ctx.fillRect(sx,sy+T-3,T,3);
    // Blade grass base
    ctx.fillStyle='#6a8a30';
    ctx.fillRect(sx+r(seed,20)+2,sy+r(seed*3,8)+T/2,1,6);
    ctx.fillRect(sx+r(seed*5,18)+8,sy+r(seed*7,6)+T/2,1,5);
    // Flower A — red/pink, 4 petals + centre
    const fx1=sx+6+r(seed,8), fy1=sy+9+r(seed*3,8);
    const PETAL1='#c84038', PETAL1L='#e06050', CENTRE1='#f0d040';
    [[0,-3],[3,0],[0,3],[-3,0]].forEach(([px,py])=>{
      ctx.fillStyle=PETAL1; ctx.beginPath(); ctx.ellipse(fx1+px,fy1+py,3,2,Math.atan2(py,px),0,Math.PI*2); ctx.fill();
      ctx.fillStyle=PETAL1L; ctx.beginPath(); ctx.ellipse(fx1+px*0.6,fy1+py*0.6,2,1,Math.atan2(py,px),0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle=CENTRE1; ctx.beginPath(); ctx.ellipse(fx1,fy1,2,2,0,0,Math.PI*2); ctx.fill();
    // Stem A
    ctx.fillStyle='#3a5820'; ctx.fillRect(fx1,fy1+3,1,5);
    // Flower B — yellow, 4 petals + centre
    const fx2=sx+T-9+r(seed*11,6), fy2=sy+12+r(seed*13,10);
    const PETAL2='#d09820', PETAL2L='#e8c040', CENTRE2='#e05828';
    [[0,-3],[3,0],[0,3],[-3,0]].forEach(([px,py])=>{
      ctx.fillStyle=PETAL2; ctx.beginPath(); ctx.ellipse(fx2+px,fy2+py,2,1.5,Math.atan2(py,px),0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle=CENTRE2; ctx.beginPath(); ctx.ellipse(fx2,fy2,1.5,1.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=PETAL2L; ctx.beginPath(); ctx.ellipse(fx2,fy2-2,1,1,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a5820'; ctx.fillRect(fx2,fy2+2,1,4);
    // Small bud C — blue/purple
    if(seed%3!==0) {
      const fx3=sx+T/2+r(seed*7,8)-4, fy3=sy+T-10;
      ctx.fillStyle='#7050c0'; ctx.beginPath(); ctx.ellipse(fx3,fy3,2,3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#9070d8'; ctx.beginPath(); ctx.ellipse(fx3,fy3-1,1.5,2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#3a5820'; ctx.fillRect(fx3,fy3+3,1,4);
    }
  }
  else if(t===TL.BUSH){
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#3e5a1e'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#243410'; ctx.fillRect(sx,sy+T-2,T,2);
    drawBushSprite(sx,sy,tx,ty);
  }
  else if(t===TL.HOBO_PORTAL){
    // North road that fades into a worn dirt track heading into the camp
    ctx.fillStyle='#897762'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#a38762'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#5b4b41'; ctx.fillRect(sx,sy+T-2,T,2);
    // Worn wheel ruts
    ctx.fillStyle='#5b4b41'; ctx.fillRect(sx+5,sy,3,T); ctx.fillRect(sx+T-8,sy,3,T);
    ctx.fillStyle='#766a64'; ctx.fillRect(sx+5,sy,1,T); ctx.fillRect(sx+T-8,sy,1,T);
    // Pulsing north arrow hint
    const hp=0.5+0.4*Math.sin(Date.now()*.003+tx);
    ctx.fillStyle=`rgba(200,220,140,${hp})`;
    ctx.beginPath();
    ctx.moveTo(sx+T/2,sy+3);
    ctx.lineTo(sx+T/2-4,sy+10);
    ctx.lineTo(sx+T/2+4,sy+10);
    ctx.closePath(); ctx.fill();
  }
  else if(t===TL.OCEAN_PORTAL){
    // Sandy beach approach — warm tan base, wet sand near water edge
    const _op_s = tx*17+ty*31;
    const _op_r = (n,m)=>((n*2654435761)>>>0)%m;
    ctx.fillStyle='#c9a46a'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#d4b078'; ctx.fillRect(sx,sy,T,2);
    ctx.fillStyle='#b8935a'; ctx.fillRect(sx,sy+T-3,T,3);
    // Rippled wet-sand texture streaks
    ctx.fillStyle='rgba(90,130,180,.22)';
    ctx.fillRect(sx,sy+T*.55,T,3);
    ctx.fillRect(sx,sy+T*.72,T,2);
    // Pulsing east arrow — ocean is this way
    const _op=0.5+0.4*Math.sin(Date.now()*.003+ty);
    ctx.fillStyle=`rgba(80,160,220,${_op})`;
    ctx.beginPath();
    ctx.moveTo(sx+T-4,sy+T/2);
    ctx.lineTo(sx+T-11,sy+T/2-4);
    ctx.lineTo(sx+T-11,sy+T/2+4);
    ctx.closePath(); ctx.fill();
  }
  else if(t===TL.MINE){
    // Ground base
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    // Arch void — dark tunnel mouth
    ctx.fillStyle='#0a0806';
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T*.62,T*.33,Math.PI,0); ctx.fill();
    ctx.fillRect(sx+T/2-T*.33,sy+T*.62,T*.66,T*.32);
    ctx.fillStyle='#060402';
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T*.62,T*.25,Math.PI,0); ctx.fill();
    ctx.fillRect(sx+T/2-T*.25,sy+T*.62,T*.5,T*.3);
    // Left timber support
    ctx.fillStyle='#6a4020'; ctx.fillRect(sx+5,sy+T*.34,5,T*.6);
    ctx.fillStyle='#7a4c28'; ctx.fillRect(sx+5,sy+T*.34,2,T*.6);
    ctx.fillStyle='#4a2c14'; ctx.fillRect(sx+8,sy+T*.34,2,T*.6);
    // Grain lines
    ctx.fillStyle='rgba(30,15,5,.25)'; ctx.fillRect(sx+6,sy+T*.38,1,T*.52); ctx.fillRect(sx+8,sy+T*.4,1,T*.48);
    // Right timber support
    ctx.fillStyle='#6a4020'; ctx.fillRect(sx+T-10,sy+T*.34,5,T*.6);
    ctx.fillStyle='#7a4c28'; ctx.fillRect(sx+T-10,sy+T*.34,2,T*.6);
    ctx.fillStyle='#4a2c14'; ctx.fillRect(sx+T-8,sy+T*.34,2,T*.6);
    ctx.fillStyle='rgba(30,15,5,.25)'; ctx.fillRect(sx+T-9,sy+T*.38,1,T*.52);
    // Crossbeam lintel
    ctx.fillStyle='#5a3818'; ctx.fillRect(sx+5,sy+T*.34,T-10,5);
    ctx.fillStyle='#6a4820'; ctx.fillRect(sx+5,sy+T*.34,T-10,2);
    ctx.fillStyle='#3a2410'; ctx.fillRect(sx+5,sy+T*.34+4,T-10,1);
    // Iron spike nails at joints
    ctx.fillStyle='#606060'; ctx.fillRect(sx+7,sy+T*.35,2,2); ctx.fillRect(sx+T-9,sy+T*.35,2,2);
    // Glimmer inside — faint lantern glow
    const mg=0.08+0.06*Math.sin(Date.now()*.0018);
    ctx.fillStyle=`rgba(200,140,40,${mg})`; ctx.fillRect(sx+T/2-5,sy+T*.48,10,8);
    // Sign above entrance
    ctx.fillStyle='#6a4020'; ctx.fillRect(sx+T/2-8,sy+T*.12,16,6);
    ctx.fillStyle='#7a4c28'; ctx.fillRect(sx+T/2-7,sy+T*.13,14,4);
    ctx.fillStyle='rgba(200,160,80,.7)'; ctx.fillRect(sx+T/2-5,sy+T*.14,10,1); ctx.fillRect(sx+T/2-4,sy+T*.16,8,1);
  }
  else if(t===TL.BADLANDS_PORTAL){
    ctx.fillStyle='#b87038'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#c88040'; ctx.fillRect(sx,sy,T,2);
    // Cracked dry earth base
    ctx.fillStyle='#985020'; ctx.fillRect(sx+2,sy+2,T-4,T-4);
    // Heat shimmer — animated horizontal bands
    const _pg=Date.now()*.0025+tx+ty;
    ctx.fillStyle=`rgba(210,130,30,${0.2+0.15*Math.sin(_pg)})`; ctx.fillRect(sx+4,sy+4,T-8,4);
    ctx.fillStyle=`rgba(230,160,50,${0.15+0.12*Math.sin(_pg+0.8)})`; ctx.fillRect(sx+4,sy+10,T-8,3);
    ctx.fillStyle=`rgba(200,110,20,${0.18+0.13*Math.sin(_pg+1.6)})`; ctx.fillRect(sx+4,sy+17,T-8,3);
    // Weathered wooden sign post
    ctx.fillStyle='#5a3010'; ctx.fillRect(sx+T/2-1,sy+T*.35,3,T*.55);
    ctx.fillStyle='#4a2408'; ctx.fillRect(sx+T/2-1,sy+T*.35,1,T*.55);
    // Sign board
    ctx.fillStyle='#7a4818'; ctx.fillRect(sx+T/2-8,sy+T*.28,16,7);
    ctx.fillStyle='#6a3c10'; ctx.fillRect(sx+T/2-7,sy+T*.29,14,5);
    // Text lines on sign
    ctx.fillStyle='rgba(200,150,60,.85)';
    ctx.fillRect(sx+T/2-5,sy+T*.30,10,1);
    ctx.fillRect(sx+T/2-4,sy+T*.32,8,1);
    // West arrow on sign pointing left
    ctx.fillStyle='rgba(240,180,60,.7)';
    ctx.beginPath();
    ctx.moveTo(sx+T/2-7,sy+T*.31);
    ctx.lineTo(sx+T/2-4,sy+T*.295);
    ctx.lineTo(sx+T/2-4,sy+T*.325);
    ctx.closePath(); ctx.fill();
    // Red dust devil swirl in corner — save/restore to contain lineWidth leak
    ctx.save();
    const sd=Date.now()*.003+tx;
    ctx.strokeStyle=`rgba(180,80,20,${0.3+0.2*Math.sin(sd)})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(sx+5,sy+T-6,3,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle=`rgba(180,80,20,${0.2+0.15*Math.sin(sd+0.6)})`;
    ctx.beginPath(); ctx.arc(sx+5,sy+T-6,5,0,Math.PI*1.5); ctx.stroke();
    ctx.restore();
  }
  else if(t===TL.BARN_CLOSED||t===TL.BARN_OPEN){
    ctx.fillStyle='#3e1808'; ctx.fillRect(sx,sy,T,T); // outline
    ctx.fillStyle='#5c2818'; ctx.fillRect(sx+1,sy+1,T-2,T-2);
    ctx.fillStyle='#6a3020'; ctx.fillRect(sx+1,sy+1,T-2,3); // top highlight
    ctx.fillStyle='#481e10'; ctx.fillRect(sx+1,sy+T-3,T-2,2); // bottom shadow
    ctx.fillStyle='#381408'; ctx.fillRect(sx,sy,T,5);
    ctx.fillStyle='#7a3828'; ctx.fillRect(sx+T/2-2,sy,4,8);
    ctx.fillStyle='#8a4030'; ctx.fillRect(sx+T/2-2,sy,2,8); // highlight
    if(t===TL.BARN_OPEN){ ctx.fillStyle='#180804'; ctx.fillRect(sx+T/2-5,sy+T-12,10,12); }
    else {
      ctx.fillStyle='#6a2e20'; ctx.fillRect(sx+T/2-5,sy+T-12,10,12);
      ctx.fillStyle='#7a3828'; ctx.fillRect(sx+T/2-5,sy+T-12,2,12);
      ctx.strokeStyle='#4a1e10'; ctx.lineWidth=1; ctx.strokeRect(sx+T/2-5,sy+T-12,10,12);
    }
  }
  else if(t===TL.FENCE_GATE){
    ctx.fillStyle='#887040'; ctx.fillRect(sx+T/2-2,sy,4,8); ctx.fillRect(sx+T/2-2,sy+T-8,4,8);
    ctx.fillStyle='#988050'; ctx.fillRect(sx+T/2-2,sy,2,8); ctx.fillRect(sx+T/2-2,sy+T-8,2,8);
    ctx.fillStyle='rgba(160,110,55,.4)'; ctx.fillRect(sx,sy+10,T,4);
    ctx.fillStyle='rgba(180,130,65,.3)'; ctx.fillRect(sx,sy+10,T,1);
  }
  else if(t===TL.FEED_TROUGH){
    ctx.fillStyle='#5a3810'; ctx.fillRect(sx+2,sy+7,T-4,T-13);
    ctx.fillStyle='#7a5028'; ctx.fillRect(sx+3,sy+8,T-6,T-15);
    ctx.fillStyle='#8a6030'; ctx.fillRect(sx+3,sy+8,T-6,2);
    ctx.fillStyle='#483010'; ctx.fillRect(sx+3,sy+T-6,T-6,2);
    ctx.fillStyle='#b88030'; ctx.fillRect(sx+5,sy+10,T-10,6);
    ctx.fillStyle='#c89040'; ctx.fillRect(sx+5,sy+10,T-10,2);
  }
  else if(t===TL.FISHING_SPOT){
    // Sandy bank dropping into water
    ctx.fillStyle='#b89858'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#c8a860'; ctx.fillRect(sx,sy,T,2);
    // Water edge — lower half
    ctx.fillStyle='#246fa6'; ctx.fillRect(sx,sy+T*0.5,T,T*0.5);
    ctx.fillStyle='#384e86'; ctx.fillRect(sx,sy+T-4,T,4);
    // Animated water ripple rings
    const rt=Date.now()*0.0018+tx*0.8+ty*0.6;
    const ra=0.35+0.25*Math.sin(rt);
    ctx.strokeStyle=`rgba(120,200,240,${ra})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T*.72,7,3,0,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle=`rgba(120,200,240,${ra*0.6})`;
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T*.72,11,5,0,0,Math.PI*2); ctx.stroke();
    // Fishing rod leaning over water — a simple drawn rod
    ctx.strokeStyle='#4a2808'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(sx+5,sy+T*.55); ctx.lineTo(sx+T*.7,sy+T*.3); ctx.stroke();
    ctx.lineWidth=1; ctx.strokeStyle='rgba(160,160,160,.7)';
    ctx.beginPath(); ctx.moveTo(sx+T*.7,sy+T*.3); ctx.lineTo(sx+T*.8,sy+T*.62); ctx.stroke();
    // Float
    ctx.fillStyle='#e03020'; ctx.fillRect(sx+T*.78,sy+T*.60,3,5);
    ctx.fillStyle='#f0f0f0'; ctx.fillRect(sx+T*.78,sy+T*.60,3,2);
    // Sandy bank pebbles
    if(seed%3===0){ctx.fillStyle='rgba(100,80,40,.4)';ctx.fillRect(sx+r(seed,10)+3,sy+r(seed*3,6)+T*.38,3,2);}
  }
  else if(t===TL.PEN_FLOOR){
    ctx.fillStyle='#9a7848'; if((tx+ty)%4===0){ctx.fillStyle='#aa8858';}
    ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle=(tx+ty)%4===0?'#ba9868':'#aa8858';
    ctx.fillRect(sx,sy,T,1);
    ctx.fillStyle='#7a5838'; ctx.fillRect(sx,sy+T-1,T,1);
  }
  else if(t===TL.TOWN_FLOOR){
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
    if((tx+ty)%2===0){
      ctx.fillStyle=c[1]; ctx.fillRect(sx+1,sy+1,T-2,T-2);
      ctx.fillStyle='#b09a7a'; ctx.fillRect(sx+1,sy+1,T-2,1); // tile highlight
      ctx.fillStyle='#706050'; ctx.fillRect(sx+1,sy+T-2,T-2,1); // tile shadow
      ctx.fillStyle='rgba(0,0,0,.2)'; // grout
      ctx.fillRect(sx,sy,T,1); ctx.fillRect(sx,sy,1,T);
    } else {
      ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(sx,sy,T,1); ctx.fillRect(sx,sy,1,T);
    }
    if((tx*5+ty*3)%11===0){ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(sx+5,sy+5,T-10,T-10);}
  }
}