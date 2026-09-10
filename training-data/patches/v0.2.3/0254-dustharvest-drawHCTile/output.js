function drawHCTile(t, tx, ty, sx, sy) {
  // Draw a hobo camp tile — same palette as overworld but reads correct map
  const seed = tx*7+ty*13;
  const r = (n,m) => ((n*2654435761)>>>0)%m;

  switch(t) {
    case TL.GRASS: {
      ctx.fillStyle='#647645'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#a8ab5c'; ctx.fillRect(sx,sy,HC_T,3);
      ctx.fillStyle='#426848'; ctx.fillRect(sx,sy+HC_T-4,HC_T,4);
      ctx.fillStyle='#292129';
      ctx.fillRect(sx+r(seed,20)+2,    sy+r(seed*3,14)+5, 1,5);
      ctx.fillRect(sx+r(seed*5,18)+8,  sy+r(seed*7,12)+7, 1,6);
      ctx.fillStyle='#a8ab5c';
      ctx.fillRect(sx+r(seed*11,14)+13,sy+r(seed*13,10)+8,1,3);
      break;
    }
    case TL.DIRT: {
      ctx.fillStyle='#7a6251'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#a38762'; ctx.fillRect(sx,sy,HC_T,2);
      ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy+HC_T-2,HC_T,2);
      if(seed%5===0){ctx.fillStyle='#5b4b41';ctx.fillRect(sx+r(seed,18)+4,sy+r(seed*3,14)+4,5,3);}
      break;
    }
    case TL.ROAD: {
      ctx.fillStyle='#897762'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#a38762'; ctx.fillRect(sx,sy,HC_T,1);
      ctx.fillStyle='#292129'; ctx.fillRect(sx,sy+HC_T-1,HC_T,1);
      ctx.fillStyle='#5b4b41'; ctx.fillRect(sx+5,sy,3,HC_T); ctx.fillRect(sx+HC_T-8,sy,3,HC_T);
      ctx.fillStyle='#766a64'; ctx.fillRect(sx+5,sy,1,HC_T); ctx.fillRect(sx+HC_T-8,sy,1,HC_T);
      break;
    }
    case TL.STONE: {
      ctx.fillStyle='#5b4b41'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#897762'; ctx.fillRect(sx,sy,HC_T,2);
      ctx.fillStyle='#292129'; ctx.fillRect(sx,sy+HC_T-2,HC_T,2);
      ctx.fillStyle='#292129'; ctx.fillRect(sx+2,sy+HC_T/2,HC_T-4,1); ctx.fillRect(sx+HC_T/2,sy+2,1,HC_T/2-1);
      ctx.fillStyle='#cfc7b2'; ctx.fillRect(sx+2,sy+HC_T/2-1,HC_T-4,1);
      break;
    }
    case TL.WATER: {
      // Same Mana Seed pixel frames as overworld but with murky green overlay
      const WC=['','#246fa6','#49a3cb','#92d2f0'];
      ctx.fillStyle='#246fa6'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#384e86'; ctx.fillRect(sx,sy+HC_T-6,HC_T,6);
      const FRAMES=[
        [[1,1,3],[2,1,2],[7,3,3],[11,3,2],[12,3,2],[6,5,2],[13,5,2],[14,5,3],[2,6,2],[3,6,2],[4,8,3],[5,8,2],[9,9,3],[2,11,2],[3,11,2],[13,11,3],[5,13,3],[14,13,2],[0,14,3],[1,14,2],[10,14,2],[11,14,2]],
        [[1,1,2],[2,1,3],[7,3,2],[11,3,2],[12,3,3],[6,5,3],[13,5,2],[14,5,2],[2,6,2],[3,6,3],[4,8,2],[5,8,3],[9,9,2],[10,9,3],[2,11,3],[3,11,2],[13,11,2],[5,13,2],[14,13,3],[0,14,2],[1,14,2],[10,14,2],[11,14,3]],
        [[1,1,2],[2,1,2],[7,3,2],[11,3,3],[12,3,2],[6,5,2],[13,5,3],[14,5,2],[2,6,3],[3,6,2],[4,8,2],[5,8,2],[9,9,2],[10,9,2],[2,11,2],[3,11,3],[13,11,2],[5,13,2],[14,13,2],[0,14,2],[1,14,3],[10,14,3],[11,14,2]],
        [[1,1,2],[2,1,3],[7,3,2],[11,3,2],[12,3,3],[6,5,3],[13,5,2],[14,5,2],[2,6,2],[3,6,3],[4,8,2],[5,8,3],[9,9,2],[10,9,3],[2,11,3],[3,11,2],[13,11,2],[5,13,2],[14,13,3],[0,14,2],[1,14,2],[10,14,2],[11,14,3]],
      ];
      // Slower frame rate for stagnant creek feel
      const fi = (Math.floor(Date.now()/500) + tx*3 + ty*5) & 3;
      const frame = FRAMES[fi];
      for(const [px,py,ci] of frame){
        ctx.fillStyle=WC[ci];
        ctx.fillRect(sx+px,   sy+py,   1,1);
        ctx.fillRect(sx+px+16,sy+py,   1,1);
        ctx.fillRect(sx+px,   sy+py+16,1,1);
        ctx.fillRect(sx+px+16,sy+py+16,1,1);
      }
      // Murky overlay — stagnant vs clean river
      ctx.fillStyle='rgba(20,50,10,.28)'; ctx.fillRect(sx,sy,HC_T,HC_T);
      // Algae patches
      if(seed%4===0){
        ctx.fillStyle='rgba(30,70,20,.35)';
        ctx.fillRect(sx+r(seed,16)+2,sy+r(seed*3,12)+4,5,3);
      }
      ctx.fillStyle='rgba(223,252,253,.15)'; ctx.fillRect(sx,sy,HC_T,1);
      break;
    }
    case TL.WALL: {
      ctx.fillStyle='#292129'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#3a3228'; ctx.fillRect(sx+1,sy+1,HC_T-2,HC_T-2);
      ctx.fillStyle='#4a4238'; ctx.fillRect(sx+1,sy+1,HC_T-2,2);
      ctx.fillStyle='#292129'; ctx.fillRect(sx+2,sy+HC_T/2,HC_T-4,1);
      if((tx+ty)%2===0){ctx.fillStyle='#292129';ctx.fillRect(sx+HC_T/2,sy+2,1,HC_T/2-1);}
      else {ctx.fillStyle='#292129';ctx.fillRect(sx+5,sy+HC_T/2+1,1,HC_T/2-3);ctx.fillRect(sx+HC_T-6,sy+2,1,HC_T/2-1);}
      ctx.fillStyle='#4a4238'; ctx.fillRect(sx+2,sy+HC_T/2-1,HC_T-4,1);
      break;
    }
    case TL.TREE: {
      const TRK=['#292129','#5b4b41','#897762','#cfc7b2'];
      const CAN=['#292129','#276b1f','#57973b','#a8c85c','#e3f19e'];
      ctx.fillStyle='#647645'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#426848'; ctx.fillRect(sx,sy+HC_T-4,HC_T,4);
      ctx.fillStyle=TRK[0]; ctx.fillRect(sx+HC_T/2-3,sy+HC_T/2-1,7,HC_T/2+3);
      ctx.fillStyle=TRK[1]; ctx.fillRect(sx+HC_T/2-2,sy+HC_T/2,5,HC_T/2+2);
      ctx.fillStyle=TRK[3]; ctx.fillRect(sx+HC_T/2-2,sy+HC_T/2,2,HC_T/2+1);
      ctx.fillStyle=TRK[2]; ctx.fillRect(sx+HC_T/2,sy+HC_T/2,3,HC_T/2+1);
      ctx.fillStyle=CAN[0]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T/2-5,13,11,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=CAN[1]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T/2-5,11,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=CAN[2]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-1,sy+HC_T/2-6,9,8,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=CAN[3]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-3,sy+HC_T/2-9,7,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=CAN[4]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-5,sy+HC_T/2-11,4,3,0,0,Math.PI*2); ctx.fill();
      break;
    }
    case TL.ROCK: {
      const RK=['#292129','#5b4b41','#897762','#cfc7b2','#e0e0d0'];
      ctx.fillStyle='#647645'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle=RK[0]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T/2+2,13,9,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=RK[1]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T/2+2,11,7,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=RK[2]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-1,sy+HC_T/2,9,6,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=RK[3]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-3,sy+HC_T/2-2,5,3,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=RK[4]; ctx.beginPath(); ctx.ellipse(sx+HC_T/2-4,sy+HC_T/2-3,2,1,0.2,0,Math.PI*2); ctx.fill();
      break;
    }
    case TL.BUSH: {
      ctx.fillStyle='#426848'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#3e5a1e'; ctx.fillRect(sx,sy,HC_T,2);
      ctx.fillStyle='#243410'; ctx.fillRect(sx,sy+HC_T-2,HC_T,2);
      // Soil patch
      ctx.fillStyle='#3a2c14'; ctx.fillRect(sx+4,sy+HC_T-8,HC_T-8,8);
      ctx.fillStyle='#2a1c08'; ctx.fillRect(sx+4,sy+HC_T-4,HC_T-8,4);
      // Stem
      ctx.fillStyle='#5b4b41'; ctx.fillRect(sx+HC_T/2-1,sy+HC_T*.45,2,HC_T*.35);
      // Multi-blob canopy — 4 layers
      ctx.fillStyle='#292129';
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T*.35,10,8,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-5,sy+HC_T*.42,6,5,-.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2+5,sy+HC_T*.40,5,4,.3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#276b1f';
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T*.33,8,7,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-4,sy+HC_T*.40,5,4,-.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2+4,sy+HC_T*.38,4,3,.3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#57973b';
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-1,sy+HC_T*.30,7,6,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-3,sy+HC_T*.37,4,3,-.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#a8c85c';
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-3,sy+HC_T*.26,5,4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e3f19e';
      ctx.beginPath(); ctx.ellipse(sx+HC_T/2-4,sy+HC_T*.22,3,2,0,0,Math.PI*2); ctx.fill();
      // Berries — small red dots
      if(seed%4===0){
        ctx.fillStyle='#d03020';
        ctx.fillRect(sx+HC_T/2+2,sy+HC_T*.38,2,2); ctx.fillRect(sx+HC_T/2-5,sy+HC_T*.42,2,2);
      }
      break;
    }
    case TL.TOWN_FLOOR: {
      // Lean-to floor — worn planks
      ctx.fillStyle='#7a6251'; ctx.fillRect(sx,sy,HC_T,HC_T);
      ctx.fillStyle='#897762'; ctx.fillRect(sx,sy,HC_T,2);
      ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy+HC_T-2,HC_T,2);
      // Plank lines
      ctx.fillStyle='#292129';
      ctx.fillRect(sx,sy+8,HC_T,1); ctx.fillRect(sx,sy+16,HC_T,1); ctx.fillRect(sx,sy+24,HC_T,1);
      break;
    }
    case TL.CAMPFIRE: {
      ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy,HC_T,HC_T);
      // Stone ring
      ctx.fillStyle='#292129'; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T*.65,HC_T*.36,HC_T*.2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#5b4b41'; ctx.beginPath(); ctx.ellipse(sx+HC_T/2,sy+HC_T*.65,HC_T*.28,HC_T*.14,0,0,Math.PI*2); ctx.fill();
      // Logs
      ctx.strokeStyle='#7a5828'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(sx+7,sy+HC_T*.74); ctx.lineTo(sx+HC_T-7,sy+HC_T*.56); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+9,sy+HC_T*.56); ctx.lineTo(sx+HC_T-9,sy+HC_T*.74); ctx.stroke();
      // Flame
      const ft=Date.now()*.004+tx+ty;
      const flk=Math.sin(ft)*2.5;
      ctx.fillStyle='rgba(180,40,8,.9)'; ctx.beginPath();
      ctx.moveTo(sx+HC_T/2,sy+HC_T*.22+flk); ctx.lineTo(sx+HC_T/2-6,sy+HC_T*.56); ctx.lineTo(sx+HC_T/2+6,sy+HC_T*.56); ctx.fill();
      ctx.fillStyle='rgba(220,110,8,.85)'; ctx.beginPath();
      ctx.moveTo(sx+HC_T/2,sy+HC_T*.30+flk); ctx.lineTo(sx+HC_T/2-4,sy+HC_T*.55); ctx.lineTo(sx+HC_T/2+4,sy+HC_T*.55); ctx.fill();
      ctx.fillStyle='rgba(240,190,40,.8)'; ctx.beginPath();
      ctx.moveTo(sx+HC_T/2,sy+HC_T*.38+flk); ctx.lineTo(sx+HC_T/2-2,sy+HC_T*.53); ctx.lineTo(sx+HC_T/2+2,sy+HC_T*.53); ctx.fill();
      break;
    }
    case TL.CRATE: {
      ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy,HC_T,HC_T);
      // Outline
      ctx.fillStyle='#292129'; ctx.fillRect(sx+3,sy+3,HC_T-6,HC_T-6);
      // Main body
      ctx.fillStyle='#5b4b41'; ctx.fillRect(sx+4,sy+4,HC_T-8,HC_T-8);
      // Top-lit highlight
      ctx.fillStyle='#897762'; ctx.fillRect(sx+4,sy+4,HC_T-8,2);
      // Bottom shadow
      ctx.fillStyle='#292129'; ctx.fillRect(sx+4,sy+HC_T-6,HC_T-8,2);
      // Cross bands — vertical and horizontal
      ctx.fillStyle='#3a2c1a';
      ctx.fillRect(sx+HC_T/2-1,sy+4,2,HC_T-8);
      ctx.fillRect(sx+4,sy+HC_T/2-1,HC_T-8,2);
      // Band highlight
      ctx.fillStyle='rgba(150,120,70,.3)';
      ctx.fillRect(sx+HC_T/2-1,sy+4,1,HC_T-8);
      ctx.fillRect(sx+4,sy+HC_T/2-1,HC_T-8,1);
      // Nail heads at band crossings and corners
      ctx.fillStyle='#505050';
      ctx.fillRect(sx+HC_T/2-1,sy+HC_T/2-1,2,2); // centre cross
      ctx.fillRect(sx+5,sy+5,2,2); ctx.fillRect(sx+HC_T-7,sy+5,2,2);
      ctx.fillRect(sx+5,sy+HC_T-7,2,2); ctx.fillRect(sx+HC_T-7,sy+HC_T-7,2,2);
      ctx.fillStyle='rgba(200,200,200,.25)'; // nail highlights
      ctx.fillRect(sx+5,sy+5,1,1); ctx.fillRect(sx+HC_T-7,sy+5,1,1);
      ctx.fillRect(sx+HC_T/2-1,sy+HC_T/2-1,1,1);
      // Stencil mark — faded numbers
      if(seed%3===0){ ctx.fillStyle='rgba(200,180,120,.15)'; ctx.fillRect(sx+6,sy+8,8,6); }
      break;
    }
    case TL.WELL: {
      ctx.fillStyle='#544b46'; ctx.fillRect(sx,sy,HC_T,HC_T);
      // Stone base ring — outer
      ctx.fillStyle='#3a2c20'; ctx.fillRect(sx+4,sy+HC_T*.4,HC_T-8,HC_T*.52);
      ctx.fillStyle='#4a3828'; ctx.fillRect(sx+5,sy+HC_T*.42,HC_T-10,HC_T*.48);
      // Brick courses on well wall
      ctx.fillStyle='rgba(0,0,0,.3)';
      ctx.fillRect(sx+5,sy+HC_T*.52,HC_T-10,1); ctx.fillRect(sx+5,sy+HC_T*.62,HC_T-10,1); ctx.fillRect(sx+5,sy+HC_T*.72,HC_T-10,1);
      const wo=(ty%2)*8;
      ctx.fillRect(sx+5+wo,sy+HC_T*.43,1,8); ctx.fillRect(sx+5+wo+8,sy+HC_T*.43,1,8);
      ctx.fillRect(sx+5+(wo+4)%16,sy+HC_T*.53,1,8); ctx.fillRect(sx+5+(wo+12)%16,sy+HC_T*.53,1,8);
      // Dark water interior
      ctx.fillStyle='#152838'; ctx.fillRect(sx+7,sy+HC_T*.45,HC_T-14,HC_T*.44);
      const wt=Date.now()*.0015+tx+ty;
      ctx.fillStyle=`rgba(40,100,160,${0.3+0.15*Math.sin(wt)})`; ctx.fillRect(sx+7,sy+HC_T*.6,HC_T-14,HC_T*.28);
      // Rope posts
      ctx.fillStyle='#5a3810'; ctx.fillRect(sx+5,sy+HC_T*.15,3,HC_T*.28); ctx.fillRect(sx+HC_T-8,sy+HC_T*.15,3,HC_T*.28);
      ctx.fillStyle='#6a4818'; ctx.fillRect(sx+5,sy+HC_T*.15,1,HC_T*.28); ctx.fillRect(sx+HC_T-8,sy+HC_T*.15,1,HC_T*.28);
      // Crossbar/winch
      ctx.fillStyle='#6a4818'; ctx.fillRect(sx+5,sy+HC_T*.15,HC_T-10,3);
      ctx.fillStyle='#7a5828'; ctx.fillRect(sx+5,sy+HC_T*.15,HC_T-10,1);
      // Rope hanging
      ctx.strokeStyle='#9a8050'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(sx+HC_T/2,sy+HC_T*.17); ctx.lineTo(sx+HC_T/2,sy+HC_T*.55); ctx.stroke();
      // Bucket
      ctx.fillStyle='#7a4818'; ctx.fillRect(sx+HC_T/2-3,sy+HC_T*.5,6,5);
      ctx.fillStyle='#8a5828'; ctx.fillRect(sx+HC_T/2-3,sy+HC_T*.5,6,2);
      ctx.fillStyle='#606060'; ctx.fillRect(sx+HC_T/2-4,sy+HC_T*.49,8,1);
      break;
    }
    default: {
      ctx.fillStyle='#647645'; ctx.fillRect(sx,sy,HC_T,HC_T);
    }
  }
}