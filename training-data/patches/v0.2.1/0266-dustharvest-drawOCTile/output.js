function drawOCTile(t, tx, ty, sx, sy) {
  const seed = (tx*7919 + ty*6271) & 0xFFFF;
  const rn = (s,m) => ((s*2654435761+1013904223)>>>0)%m;

  switch(t) {

    case OC.SAND: {
      // Layered beach sand — warm ochre-tan, varied grain, shells, wet-line shadow
      // Three base tones cycling by seed so it looks patchy and real
      const bases=['#be9955','#c8a462','#b89050','#c4a068','#b08848'];
      ctx.fillStyle=bases[seed%5]; ctx.fillRect(sx,sy,OC_T,OC_T);
      // Sun crust — thin bright top edge
      ctx.fillStyle='#d4b870'; ctx.fillRect(sx,sy,OC_T,1);
      // Wet shadow bottom
      ctx.fillStyle='#8a6438'; ctx.fillRect(sx,sy+OC_T-3,OC_T,3);
      // Mid-tone band (damp line)
      if(seed%3===0){ ctx.fillStyle='rgba(100,60,20,.12)'; ctx.fillRect(sx,sy+OC_T-7,OC_T,4); }
      // Grit flecks — dark
      ctx.fillStyle='#7a5228';
      ctx.fillRect(sx+rn(seed,OC_T-2),   sy+rn(seed+1,OC_T-4)+2, 2,1);
      ctx.fillRect(sx+rn(seed+2,OC_T-3)+3,sy+rn(seed+3,OC_T-4)+2, 1,2);
      // Grit flecks — light
      ctx.fillStyle='#dcc888';
      ctx.fillRect(sx+rn(seed+4,OC_T-2), sy+rn(seed+5,OC_T-4)+2, 2,1);
      // Shell — 1 in 6 tiles
      if(seed%6===0){
        const sx2=sx+rn(seed+8,OC_T-8)+4, sy2=sy+rn(seed+9,OC_T-8)+4;
        ctx.fillStyle='#e8dfc4';
        ctx.beginPath(); ctx.ellipse(sx2,sy2,3,2,0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#c8b898';
        ctx.beginPath(); ctx.ellipse(sx2,sy2,2,1,0.4,0,Math.PI*2); ctx.fill();
      }
      // Dried seaweed — 1 in 9
      if(seed%9===0){
        ctx.strokeStyle='#5a7840'; ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(sx+rn(seed+12,OC_T-4)+2,sy+rn(seed+13,OC_T-6)+3);
        ctx.lineTo(sx+rn(seed+14,OC_T-4)+2,sy+rn(seed+15,OC_T-6)+3);
        ctx.stroke();
      }
      break;
    }

    case OC.GRASS: {
      // Sparse beach grass — dry, salt-bleached, sandy base
      ctx.fillStyle='#b09050'; ctx.fillRect(sx,sy,OC_T,OC_T);
      const gt=Date.now()*0.0008+tx*0.4;
      ctx.strokeStyle='#8a9048'; ctx.lineWidth=1.5;
      for(let i=0;i<4;i++){
        const bx=sx+4+i*7, by=sy+OC_T-6;
        const sw=Math.sin(gt+i*0.9)*2;
        ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+sw,by-9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx+2,by); ctx.lineTo(bx+2+sw*0.7,by-6); ctx.stroke();
      }
      break;
    }

    case OC.WATER: {
      // Shallow coastal — teal, animated, sandy bottom visible
      ctx.fillStyle='#1e7090'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#186080'; ctx.fillRect(sx,sy+OC_T-4,OC_T,4);
      // Sandy bottom shimmer
      ctx.fillStyle='rgba(160,128,60,.14)'; ctx.fillRect(sx+2,sy+6,OC_T-4,9);
      const rt=Date.now()*0.0014+tx*0.7+ty*0.5;
      const rA=0.5+0.35*Math.sin(rt), rB=0.4+0.28*Math.sin(rt+1.5);
      ctx.fillStyle=`rgba(80,190,220,${rA*0.2})`; ctx.fillRect(sx+1,sy+4,OC_T-2,2);
      ctx.fillStyle=`rgba(80,190,220,${rB*0.15})`; ctx.fillRect(sx+3,sy+13,OC_T-6,2);
      ctx.fillStyle=`rgba(80,190,220,${rA*0.12})`; ctx.fillRect(sx,sy+22,OC_T-2,1);
      ctx.fillStyle=`rgba(255,255,255,${0.08+0.06*Math.sin(rt*1.4)})`; ctx.fillRect(sx,sy,OC_T,1);
      break;
    }

    case OC.DEEP: {
      // Open ocean — deep indigo-navy, moving swells, white foam
      ctx.fillStyle='#0c2e50'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#081e38'; ctx.fillRect(sx,sy+OC_T-5,OC_T,5);
      const wt=Date.now()*0.0008+tx*0.9+ty*0.7;
      const wa=0.45+0.4*Math.sin(wt);
      ctx.fillStyle=`rgba(20,70,140,${wa*0.5})`; ctx.fillRect(sx,sy+3,OC_T,3);
      ctx.fillStyle=`rgba(40,90,160,${(1-wa)*0.4})`; ctx.fillRect(sx+2,sy+14,OC_T-4,2);
      // Foam
      if(seed%4===0){
        const fw=0.12+0.09*Math.sin(wt*1.9);
        ctx.fillStyle=`rgba(210,235,255,${fw})`;
        ctx.fillRect(sx+rn(seed,OC_T-5)+2, sy+rn(seed+1,OC_T-8)+3, 4,1);
      }
      if(ty===0){ ctx.fillStyle='rgba(255,190,80,.06)'; ctx.fillRect(sx,sy,OC_T,OC_T/2); }
      break;
    }

    case OC.DOCK: {
      // Salt-weathered planks — grey-brown, plank grain, nail heads, shimmer through gaps
      const pb=(tx+ty)%2===0?'#7e6c52':'#746248';
      ctx.fillStyle=pb; ctx.fillRect(sx,sy,OC_T,OC_T);
      // Plank seams
      ctx.fillStyle='#584c38'; ctx.fillRect(sx,sy,OC_T,1);
      ctx.fillStyle='#584c38'; ctx.fillRect(sx,sy+OC_T/2,OC_T,1);
      ctx.fillStyle='#8a7860'; ctx.fillRect(sx,sy+1,OC_T,1);
      // Knot holes / grain
      if(seed%7===0){ ctx.fillStyle='rgba(40,28,16,.3)'; ctx.beginPath(); ctx.ellipse(sx+rn(seed,OC_T-8)+4,sy+rn(seed+1,OC_T-8)+4,3,2,0,0,Math.PI*2); ctx.fill(); }
      // Salt bleach patches
      if(seed%5===0){ ctx.fillStyle='rgba(200,180,140,.15)'; ctx.fillRect(sx+rn(seed+2,OC_T-6)+3,sy+rn(seed+3,OC_T-6)+3,5,3); }
      // Nail heads
      ctx.fillStyle='#3a2c1c'; ctx.fillRect(sx+3,sy+2,2,2); ctx.fillRect(sx+OC_T-5,sy+2,2,2);
      ctx.fillStyle='#6e6050'; ctx.fillRect(sx+3,sy+2,1,1); ctx.fillRect(sx+OC_T-5,sy+2,1,1);
      // Water glimmer through gaps (dock over water)
      if(tx>=9){
        const shim=0.05+0.04*Math.sin(Date.now()*0.0018+tx+ty);
        ctx.fillStyle=`rgba(30,100,170,${shim})`; ctx.fillRect(sx,sy+OC_T-2,OC_T,2);
      }
      break;
    }

    case OC.GANGPLANK: {
      // Gangplank — angled dock connector, slightly different tone
      ctx.fillStyle='#6e5c44'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#7e6c54'; ctx.fillRect(sx,sy,OC_T,2);
      // Cross-plank lines
      for(let i=0;i<4;i++){ ctx.fillStyle='#504030'; ctx.fillRect(sx,sy+i*8,OC_T,1); }
      // Rope guide rails
      ctx.strokeStyle='#8a7050'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,sy+OC_T); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+OC_T,sy); ctx.lineTo(sx+OC_T,sy+OC_T); ctx.stroke();
      // Arrow sign pointing east when no boat owned — guides player
      if (!hasBoat()) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.003);
        ctx.fillStyle = `rgba(240,200,80,${pulse})`;
        // Arrow body
        ctx.fillRect(sx+4, sy+OC_T/2-2, OC_T-10, 4);
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(sx+OC_T-5, sy+OC_T/2-6);
        ctx.lineTo(sx+OC_T-1, sy+OC_T/2);
        ctx.lineTo(sx+OC_T-5, sy+OC_T/2+6);
        ctx.fill();
      }
      break;
    }

    case OC.POST: {
      // Barnacled timber post
      ctx.fillStyle='#1e7090'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#3e2818'; ctx.fillRect(sx+OC_T/2-4,sy,8,OC_T);
      ctx.fillStyle='#523828'; ctx.fillRect(sx+OC_T/2-3,sy,6,OC_T);
      // Grain
      for(let i=0;i<3;i++){ ctx.fillStyle='rgba(20,12,6,.2)'; ctx.fillRect(sx+OC_T/2-3,sy+i*10+2,6,1); }
      // Barnacles
      ctx.fillStyle='#b8b0a0';
      for(let i=0;i<5;i++) ctx.fillRect(sx+OC_T/2-3+rn(seed*i+3,6),sy+rn(seed*(i+1),OC_T-4)+2,2,2);
      ctx.fillStyle='#888078';
      for(let i=0;i<3;i++) ctx.fillRect(sx+OC_T/2-2+rn(seed*i+9,4),sy+rn(seed*(i+2)+7,OC_T-4)+2,1,1);
      // Mooring rope
      ctx.strokeStyle='#907850'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(sx+OC_T/2-4,sy+4); ctx.lineTo(sx+OC_T/2+4,sy+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+OC_T/2-4,sy+7); ctx.lineTo(sx+OC_T/2+4,sy+7); ctx.stroke();
      break;
    }

    case OC.BOAT_DECK: {
      // Top-down boat deck — planked, with interior detail
      const tier = getBoatTier();
      if (!tier) {
        // No boat — empty mooring slip, water with dock outline and "SLIP" marker
        ctx.fillStyle='#1a4868'; ctx.fillRect(sx,sy,OC_T,OC_T);
        // Water animation
        const st=Date.now()*0.0012+tx*0.6+ty*0.4;
        ctx.fillStyle=`rgba(30,110,180,${0.15+0.1*Math.sin(st)})`; ctx.fillRect(sx,sy+4,OC_T,3);
        ctx.fillStyle=`rgba(30,110,180,${0.1+0.08*Math.sin(st+1.2)})`; ctx.fillRect(sx,sy+14,OC_T,2);
        // Dock border lines showing slip edges
        ctx.strokeStyle='rgba(110,90,50,.55)'; ctx.lineWidth=1.5;
        ctx.strokeRect(sx+1,sy+1,OC_T-2,OC_T-2);
        // Mooring cleat marks at corners
        ctx.fillStyle='rgba(90,70,40,.7)'; ctx.fillRect(sx+2,sy+2,3,3); ctx.fillRect(sx+OC_T-5,sy+2,3,3);
        ctx.fillRect(sx+2,sy+OC_T-5,3,3); ctx.fillRect(sx+OC_T-5,sy+OC_T-5,3,3);
        break;
      }
      // Boat colours by tier
      const hullC=['#5a3818','#4a3010','#3a2810','#2a2010'];
      const deckC=['#6e4828','#5e3c1e','#4e301a','#3e2416'];
      const tierIdx=BOAT_TIERS.findIndex(b=>b.id===tier.id);
      const hi=Math.min(tierIdx,3);
      ctx.fillStyle=hullC[hi]; ctx.fillRect(sx,sy,OC_T,OC_T);
      // Hull walls
      ctx.fillStyle=deckC[hi]; ctx.fillRect(sx+2,sy+2,OC_T-4,OC_T-4);
      // Interior planks
      ctx.fillStyle=`rgba(0,0,0,.2)`;
      for(let i=0;i<3;i++) ctx.fillRect(sx+4,sy+4+i*8,OC_T-8,1);
      // Mast foot
      if(hi>=1){
        ctx.fillStyle='#6e5020'; ctx.fillRect(sx+OC_T/2-2,sy+OC_T/2-2,4,4);
        ctx.fillStyle='#1a1008'; ctx.fillRect(sx+OC_T/2-1,sy+OC_T/2-1,2,2);
      }
      // Cannon on barque
      if(hi===3){
        ctx.fillStyle='#303030'; ctx.fillRect(sx+4,sy+OC_T/2-2,6,4);
        ctx.fillStyle='#202020'; ctx.fillRect(sx+OC_T-10,sy+OC_T/2-2,6,4);
      }
      // Rope coil
      ctx.strokeStyle='#908060'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(sx+8,sy+OC_T-8,3,0,Math.PI*2); ctx.stroke();
      break;
    }

    case OC.SEAGRASS: {
      ctx.fillStyle='#1e7090'; ctx.fillRect(sx,sy,OC_T,OC_T);
      const sgt=Date.now()*0.0009+tx*0.5;
      for(let i=0;i<5;i++){
        const bx=sx+3+i*5, by=sy+OC_T/2+2;
        const wave=Math.sin(sgt+i*0.8)*2.5;
        ctx.fillStyle=i%2===0?'rgba(28,100,55,.85)':'rgba(35,120,60,.7)';
        ctx.fillRect(bx+wave,by-10,2,12);
        ctx.fillRect(bx-1+wave*0.6,by-12,2,5);
      }
      break;
    }

    case OC.FIRE: {
      ctx.fillStyle='#a88848'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#201818'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2,sy+OC_T*.65,OC_T*.36,OC_T*.2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#4a3a28'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2,sy+OC_T*.65,OC_T*.26,OC_T*.13,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#7a5828'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(sx+7,sy+OC_T*.73); ctx.lineTo(sx+OC_T-7,sy+OC_T*.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+9,sy+OC_T*.55); ctx.lineTo(sx+OC_T-9,sy+OC_T*.73); ctx.stroke();
      const ft=Date.now()*.004+tx+ty, flk=Math.sin(ft)*2.5;
      ctx.fillStyle='rgba(200,50,8,.9)'; ctx.beginPath();
      ctx.moveTo(sx+OC_T/2,sy+OC_T*.22+flk); ctx.lineTo(sx+OC_T/2-6,sy+OC_T*.55); ctx.lineTo(sx+OC_T/2+6,sy+OC_T*.55); ctx.fill();
      ctx.fillStyle='rgba(240,160,30,.85)'; ctx.beginPath();
      ctx.moveTo(sx+OC_T/2,sy+OC_T*.36+flk); ctx.lineTo(sx+OC_T/2-3,sy+OC_T*.53); ctx.lineTo(sx+OC_T/2+3,sy+OC_T*.53); ctx.fill();
      break;
    }

    case OC.CRATE: {
      ctx.fillStyle='#a08848'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#201808'; ctx.fillRect(sx+3,sy+3,OC_T-6,OC_T-6);
      ctx.fillStyle='#604828'; ctx.fillRect(sx+4,sy+4,OC_T-8,OC_T-8);
      ctx.fillStyle='#785838'; ctx.fillRect(sx+4,sy+4,OC_T-8,2);
      ctx.fillStyle='#201808'; ctx.fillRect(sx+4,sy+OC_T-6,OC_T-8,2);
      ctx.fillStyle='#6e5030'; ctx.fillRect(sx+OC_T/2-1,sy+4,2,OC_T-8);
      ctx.fillRect(sx+4,sy+OC_T/2-1,OC_T-8,2);
      // Salt staining
      if(seed%4===0){ ctx.fillStyle='rgba(200,190,160,.12)'; ctx.fillRect(sx+4,sy+4,OC_T-8,3); }
      break;
    }

    case OC.ROCK: {
      ctx.fillStyle='#a08848'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#505458'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2,sy+OC_T/2+2,13,9,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#686c70'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2,sy+OC_T/2,11,7,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#909498'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2-2,sy+OC_T/2-2,7,5,0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#b8bcc0'; ctx.beginPath(); ctx.ellipse(sx+OC_T/2-3,sy+OC_T/2-3,3,2,0.2,0,Math.PI*2); ctx.fill();
      // Barnacles
      ctx.fillStyle='rgba(190,185,170,.55)';
      ctx.fillRect(sx+OC_T/2+3,sy+OC_T/2+2,3,2);
      ctx.fillRect(sx+OC_T/2-1,sy+OC_T/2+3,2,2);
      break;
    }

    case OC.TREE: {
      // Gnarled beach palm
      ctx.fillStyle='#b09050'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#3e2410'; ctx.fillRect(sx+OC_T/2-2,sy+OC_T/2,5,OC_T/2+4);
      ctx.fillStyle='#523018'; ctx.fillRect(sx+OC_T/2-1,sy+OC_T/2,3,OC_T/2+3);
      // Bark rings
      ctx.fillStyle='#2e1808'; for(let i=0;i<5;i++) ctx.fillRect(sx+OC_T/2-2,sy+OC_T/2+i*5,5,1);
      const pt=Date.now()*0.0007+tx;
      [[-14,-7],[-9,-13],[0,-16],[9,-13],[14,-7]].forEach(([dx,dy])=>{
        const sw=Math.sin(pt+dx*0.08)*1.8;
        ctx.strokeStyle='#286018'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(sx+OC_T/2,sy+OC_T/2+sw); ctx.lineTo(sx+OC_T/2+dx,sy+OC_T/2+dy+sw); ctx.stroke();
        ctx.fillStyle='#389840';
        ctx.beginPath(); ctx.ellipse(sx+OC_T/2+dx,sy+OC_T/2+dy+sw,4,2,Math.atan2(dy,dx),0,Math.PI*2); ctx.fill();
      });
      ctx.fillStyle='#44b048';
      ctx.beginPath(); ctx.ellipse(sx+OC_T/2,sy+OC_T/2-5,5,4,0,0,Math.PI*2); ctx.fill();
      break;
    }

    case OC.FLOOR: {
      const pb2=(tx+ty)%2===0?'#7a6848':'#706040';
      ctx.fillStyle=pb2; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#908058'; ctx.fillRect(sx,sy,OC_T,1);
      ctx.fillStyle='#584838'; ctx.fillRect(sx,sy+OC_T-2,OC_T,2);
      // Plank seam lines with slight color variation
      ctx.fillStyle='#504030';
      ctx.fillRect(sx,sy+8,OC_T,1); ctx.fillRect(sx,sy+16,OC_T,1); ctx.fillRect(sx,sy+24,OC_T,1);
      // Plank grain — faint directional streaks
      if(seed%3===0){ ctx.fillStyle='rgba(80,55,25,.2)'; ctx.fillRect(sx+rn(seed,OC_T-6)+3,sy+3,1,5); }
      if(seed%4===0){ ctx.fillStyle='rgba(80,55,25,.15)'; ctx.fillRect(sx+rn(seed+2,OC_T-6)+3,sy+11,1,4); }
      // Salt tide stain — lighter deposit near one edge
      if(seed%5===0){ ctx.fillStyle='rgba(200,190,160,.1)'; ctx.fillRect(sx,sy+OC_T-6,OC_T,5); }
      // Knot hole
      if(seed%7===0){ ctx.fillStyle='rgba(30,18,8,.3)'; ctx.beginPath(); ctx.ellipse(sx+rn(seed+4,OC_T-8)+4,sy+rn(seed+5,OC_T-8)+4,2,1.5,0,0,Math.PI*2); ctx.fill(); }
      break;
    }

    case OC.WALL: {
      ctx.fillStyle='#3c3020'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#4c4030'; ctx.fillRect(sx+1,sy+1,OC_T-2,OC_T-2);
      ctx.fillStyle='#5c5040'; ctx.fillRect(sx+1,sy+1,OC_T-2,2);
      ctx.fillStyle='#2c2010'; ctx.fillRect(sx+2,sy+OC_T/2,OC_T-4,1);
      if((tx+ty)%2===0){ ctx.fillStyle='#2c2010'; ctx.fillRect(sx+OC_T/2,sy+2,1,OC_T/2-1); }
      else { ctx.fillStyle='#2c2010'; ctx.fillRect(sx+5,sy+OC_T/2+1,1,OC_T/2-3); ctx.fillRect(sx+OC_T-6,sy+2,1,OC_T/2-1); }
      if(seed%3===0){ ctx.fillStyle='rgba(200,180,140,.1)'; ctx.fillRect(sx+2,sy+2,OC_T-4,3); }
      break;
    }

    case OC.ROAD: {
      ctx.fillStyle='#a89060'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#b8a070'; ctx.fillRect(sx,sy,OC_T,1);
      ctx.fillStyle='#887050'; ctx.fillRect(sx,sy+OC_T-1,OC_T,1);
      ctx.fillStyle='#887050'; ctx.fillRect(sx+5,sy,3,OC_T); ctx.fillRect(sx+OC_T-8,sy,3,OC_T);
      break;
    }

    case OC.EXIT: {
      ctx.fillStyle='#b09050'; ctx.fillRect(sx,sy,OC_T,OC_T);
      ctx.fillStyle='#c0a060'; ctx.fillRect(sx,sy,OC_T,2);
      // Worn cart ruts leading west
      ctx.fillStyle='#8a7040'; ctx.fillRect(sx+4,sy,3,OC_T); ctx.fillRect(sx+OC_T-7,sy,3,OC_T);
      ctx.fillStyle='#a08050'; ctx.fillRect(sx+4,sy,1,OC_T); ctx.fillRect(sx+OC_T-7,sy,1,OC_T);
      // Weathered signpost
      ctx.fillStyle='#5a3810'; ctx.fillRect(sx+OC_T/2-1,sy+4,3,OC_T-10);
      ctx.fillStyle='#6a4818'; ctx.fillRect(sx+OC_T/2-1,sy+4,1,OC_T-10);
      // Sign board pointing west
      ctx.fillStyle='#7a4c18'; ctx.fillRect(sx+OC_T/2-9,sy+6,14,7);
      ctx.fillStyle='#8a5c28'; ctx.fillRect(sx+OC_T/2-8,sy+7,12,5);
      // Arrow shape pointing left
      const ep=0.65+0.3*Math.sin(Date.now()*.003+ty);
      ctx.fillStyle=`rgba(200,220,140,${ep})`;
      ctx.beginPath();
      ctx.moveTo(sx+OC_T/2-8,sy+9.5);
      ctx.lineTo(sx+OC_T/2-4,sy+7);
      ctx.lineTo(sx+OC_T/2-4,sy+9);
      ctx.lineTo(sx+OC_T/2+4,sy+9);
      ctx.lineTo(sx+OC_T/2+4,sy+11);
      ctx.lineTo(sx+OC_T/2-4,sy+11);
      ctx.lineTo(sx+OC_T/2-4,sy+13);
      ctx.closePath(); ctx.fill();
      // Nail heads
      ctx.fillStyle='#404040';
      ctx.fillRect(sx+OC_T/2-8,sy+7,2,2); ctx.fillRect(sx+OC_T/2+4,sy+7,2,2);
      ctx.fillRect(sx+OC_T/2-8,sy+11,2,2); ctx.fillRect(sx+OC_T/2+4,sy+11,2,2);
      break;
    }

    default: ctx.fillStyle='#a89050'; ctx.fillRect(sx,sy,OC_T,OC_T);
  }
}