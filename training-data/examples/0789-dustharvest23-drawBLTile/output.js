function drawBLTile(tx,ty,sx,sy) {
  const t=getBLT(tx,ty);
  // Special rendering for railroad tracks
  if (t === BL.RAIL_TRACK) {
    ctx.fillStyle='#3a2818'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#706050'; ctx.fillRect(sx,sy+4,T,3); ctx.fillRect(sx,sy+T-7,T,3);
    ctx.fillStyle='#908070'; ctx.fillRect(sx,sy+4,T,1); ctx.fillRect(sx,sy+T-7,T,1);
    return;
  }
  // Special rendering for BL mine entrance
  if (t === BL.BL_MINE) {
    ctx.fillStyle='#1a1214'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#2a2018'; ctx.fillRect(sx+4,sy+4,T-8,T-4);
    ctx.fillStyle='#0a0808'; ctx.fillRect(sx+6,sy+6,T-12,T-8);
    ctx.fillStyle='#5a3818'; ctx.fillRect(sx+4,sy+4,3,T-8); ctx.fillRect(sx+T-7,sy+4,3,T-8);
    ctx.fillStyle='#4a2810'; ctx.fillRect(sx+4,sy+4,T-8,3);
    return;
  }

  const h=(tx*7919+ty*6271)&0xffff; // stable hash per tile
  const h2=(tx*3761+ty*9437)&0xffff;

  if(t===BL.DUSTFLOOR) {
    // Sandy dust — warm tan with wind-streak texture
    ctx.fillStyle='#c8a870'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#b89860'; ctx.fillRect(sx,sy,T,T/2); // slight horizon split
    // Wind streaks — 2-3 per tile, stable
    ctx.fillStyle='rgba(180,150,90,.22)';
    if(h%5<3){ ctx.fillRect(sx+(h%10)+2,sy+(h2%8)+4,8+h%6,1); }
    if(h2%4<2){ ctx.fillRect(sx+(h2%12)+1,sy+(h%12)+12,5+h2%8,1); }
    // Occasional pebble
    if(h%7===0){ ctx.fillStyle='rgba(140,110,70,.45)'; ctx.fillRect(sx+(h%14)+3,sy+(h2%14)+5,2,2); }

  } else if(t===BL.CRACKED) {
    // Cracked dry earth — warm base with fracture network
    ctx.fillStyle='#b89050'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#a07840'; ctx.fillRect(sx+1,sy+1,T-2,T-2);
    // Sub-tile shading — make it look like raised cracked slabs
    ctx.fillStyle='rgba(80,50,20,.18)';
    ctx.fillRect(sx,sy+T-4,T,4); ctx.fillRect(sx+T-4,sy,4,T);
    // Crack network — 3 lines, deterministic angles
    ctx.save();
    ctx.strokeStyle='#6a4820'; ctx.lineWidth=1;
    const s0=(h%8)+2;
    ctx.beginPath(); ctx.moveTo(sx+s0,sy+T/3); ctx.lineTo(sx+T-s0-2,sy+T*2/3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+T/2+h%5,sy+2); ctx.lineTo(sx+T/3,sy+T-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+2,sy+T/2+(h2%8)-4); ctx.lineTo(sx+T/2,sy+T-3); ctx.stroke();
    ctx.restore();
    // Highlight edge of one slab
    ctx.fillStyle='rgba(200,170,110,.15)';
    ctx.fillRect(sx+(h%12)+2,sy+(h2%10)+2,T/3,1);

  } else if(t===BL.REDROCK) {
    // Layered red sandstone — sedimentary strata
    ctx.fillStyle='#b84828'; ctx.fillRect(sx,sy,T,T);
    // Strata layers — 3 bands
    const bands=['#c85030','#a03820','#d06040'];
    for(let i=0;i<3;i++){
      ctx.fillStyle=bands[i];
      ctx.fillRect(sx,sy+i*(T/3),T,T/3-1);
    }
    // Surface pitting
    ctx.fillStyle='rgba(60,15,5,.3)';
    ctx.fillRect(sx+(h%10)+3,sy+(h2%8)+2,4,3);
    ctx.fillRect(sx+(h2%8)+T/2,sy+(h%10)+T/3,3,2);
    // Edge shadow (gives 3D slab feel)
    ctx.fillStyle='rgba(0,0,0,.18)';
    ctx.fillRect(sx,sy+T-3,T,3); ctx.fillRect(sx+T-3,sy,3,T);
    // Highlight top edge
    ctx.fillStyle='rgba(220,130,80,.25)';
    ctx.fillRect(sx,sy,T,2); ctx.fillRect(sx,sy,2,T);

  } else if(t===BL.ASH) {
    // Deep zone ash — grey with bone-white flecks and char patches
    ctx.fillStyle='#686058'; ctx.fillRect(sx,sy,T,T);
    // Char patches
    if(h%4===0){ ctx.fillStyle='#484038'; ctx.fillRect(sx+(h%14)+1,sy+(h2%10)+2,h%8+4,h2%6+3); }
    // Bone-white ash flecks
    ctx.fillStyle='rgba(200,190,170,.2)';
    if(h%3===0) ctx.fillRect(sx+(h2%20)+2,sy+(h%14)+3,2,1);
    if(h2%5===0) ctx.fillRect(sx+(h%18)+1,sy+(h2%18)+2,1,2);
    // Fine ash texture — dense small dots
    ctx.fillStyle='rgba(110,100,90,.3)';
    for(let i=0;i<2;i++){
      const ax=(h*17+i*31)%26+1, ay=(h2*13+i*19)%24+2;
      ctx.fillRect(sx+ax,sy+ay,1,1);
    }

  } else if(t===BL.MESA) {
    // Mesa plateau — flat top, steep layered sides
    ctx.fillStyle='#7a2808'; ctx.fillRect(sx,sy,T,T); // deep shadow base
    ctx.fillStyle='#c05030'; ctx.fillRect(sx+2,sy+2,T-4,T-4); // main face
    // Strata on face
    ctx.fillStyle='#d06840'; ctx.fillRect(sx+2,sy+4,T-4,5);
    ctx.fillStyle='#a03820'; ctx.fillRect(sx+2,sy+T/2,T-4,4);
    ctx.fillStyle='#b84830'; ctx.fillRect(sx+2,sy+T-8,T-4,5);
    // Top surface highlight
    ctx.fillStyle='rgba(220,140,80,.2)';
    ctx.fillRect(sx+2,sy+2,T-4,3);
    // Left/right wall shadow
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.fillRect(sx+T-4,sy,4,T); ctx.fillRect(sx,sy+T-4,T,4);
    // Surface pitting
    ctx.fillStyle='rgba(80,20,5,.25)';
    ctx.fillRect(sx+(h%10)+4,sy+(h2%8)+6,3,2);

  } else if(t===BL.CANYON) {
    // Deep canyon — abyss with rocky wall hints
    ctx.fillStyle='#0e0604'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#180a04'; ctx.fillRect(sx+2,sy+2,T-4,T-4);
    // Void centre
    ctx.fillStyle='#080402'; ctx.fillRect(sx+5,sy+5,T-10,T-10);
    // Rocky ledge edges — warm rust on the rim
    ctx.fillStyle='#5a2010';
    ctx.fillRect(sx,sy,T,3); ctx.fillRect(sx,sy,3,T);
    ctx.fillStyle='#3a1408';
    ctx.fillRect(sx,sy+T-3,T,3); ctx.fillRect(sx+T-3,sy,3,T);
    // Depth hint — faint horizontal banding in void
    ctx.fillStyle='rgba(40,15,5,.4)';
    ctx.fillRect(sx+5,sy+T/2-1,T-10,1);
    ctx.fillStyle='rgba(20,8,2,.5)';
    ctx.fillRect(sx+6,sy+T/2+3,T-12,1);

  } else if(t===BL.DEADWOOD) {
    // Dead bleached tree stump/snag
    ctx.fillStyle='#c0b090'; // trunk
    ctx.fillRect(sx+T/2-3,sy+5,6,T-8);
    // Trunk grain lines
    ctx.fillStyle='rgba(130,110,70,.4)';
    ctx.fillRect(sx+T/2-3,sy+7,1,T-12);
    ctx.fillRect(sx+T/2+2,sy+9,1,T-14);
    // Two dead branches
    ctx.fillStyle='#d0c0a0';
    ctx.fillRect(sx+T/2-10,sy+8,9,3); // left branch
    ctx.fillRect(sx+T/2+1,sy+13,8,2); // right branch lower
    // Branch knots
    ctx.fillStyle='rgba(100,80,50,.5)';
    ctx.fillRect(sx+T/2-4,sy+7,3,3); ctx.fillRect(sx+T/2-4,sy+12,3,2);
    // Bleach highlight
    ctx.fillStyle='rgba(240,225,190,.3)';
    ctx.fillRect(sx+T/2-2,sy+5,1,T-10);

  } else if(t===BL.SKULL_ROCK) {
    // Wind-carved pale rock — suggestive of a skull but abstract
    ctx.fillStyle='#484040'; ctx.fillRect(sx,sy,T,T);
    // Main rock mass — rounded
    ctx.fillStyle='#5e5252';
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+1,T/2-2,T/2-3,0,0,Math.PI*2); ctx.fill();
    // Lighter worn face
    ctx.fillStyle='#726666';
    ctx.beginPath(); ctx.ellipse(sx+T/2-1,sy+T/2-1,T/2-5,T/2-6,0,0,Math.PI*2); ctx.fill();
    // Two shadowed hollow pits (eye-socket suggestion)
    ctx.fillStyle='#1e1818';
    ctx.beginPath(); ctx.ellipse(sx+T/2-5,sy+T/2-4,4,3,0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx+T/2+5,sy+T/2-4,4,3,-0.2,0,Math.PI*2); ctx.fill();
    // Wind-erosion horizontal groove
    ctx.fillStyle='#2a2424';
    ctx.fillRect(sx+T/2-8,sy+T/2+3,T/2+2,2);
    // Base shadow
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.fillRect(sx+3,sy+T-5,T-6,4);
    // Rock highlight — top-left lit
    ctx.fillStyle='rgba(200,185,175,.18)';
    ctx.beginPath(); ctx.ellipse(sx+T/2-4,sy+T/2-6,5,3,0.4,0,Math.PI*2); ctx.fill();

  } else if(t===BL.SULFUR) {
    // Sulfur crust — crumbly yellow mineral deposit
    ctx.fillStyle='#a89028'; ctx.fillRect(sx,sy,T,T);
    // Crystalline cluster shapes
    ctx.fillStyle='#e8d040';
    ctx.beginPath(); ctx.moveTo(sx+5,sy+T/2+2); ctx.lineTo(sx+9,sy+T/2-6); ctx.lineTo(sx+13,sy+T/2+2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx+13,sy+T/2+3); ctx.lineTo(sx+17,sy+T/2-5); ctx.lineTo(sx+21,sy+T/2+3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx+9,sy+T/2+4); ctx.lineTo(sx+13,sy+T/2-2); ctx.lineTo(sx+17,sy+T/2+4); ctx.closePath(); ctx.fill();
    // Bright crystal tips
    ctx.fillStyle='#fff0a0';
    ctx.fillRect(sx+8,sy+T/2-7,2,2); ctx.fillRect(sx+16,sy+T/2-6,2,2); ctx.fillRect(sx+12,sy+T/2-3,2,2);
    // Powdery edge
    ctx.fillStyle='rgba(200,190,60,.2)';
    ctx.fillRect(sx,sy+T-4,T,4);
    // Shadow under crystals
    ctx.fillStyle='rgba(80,60,0,.3)';
    ctx.fillRect(sx+4,sy+T/2+2,T-8,3);

  } else if(t===BL.TUMBLEWEED) {
    // Dried thorn-bush tumbleweed resting against something
    ctx.fillStyle='#c8a870'; ctx.fillRect(sx,sy,T,T); // dusty ground beneath
    // Main ball body
    ctx.fillStyle='#9a7e48';
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+1,10,8,0,0,Math.PI*2); ctx.fill();
    ctx.save();
    // Inner tangle
    ctx.strokeStyle='#786030'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T/2+1,7,0.3,3.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx+T/2,sy+T/2+1,5,1.5,5.2); ctx.stroke();
    // Thorn spines radiating out
    ctx.strokeStyle='rgba(140,110,50,.7)'; ctx.lineWidth=1;
    for(let sp=0;sp<6;sp++){
      const ang=sp*1.047+h%6*0.1;
      ctx.beginPath();
      ctx.moveTo(sx+T/2+Math.cos(ang)*8,sy+T/2+1+Math.sin(ang)*6);
      ctx.lineTo(sx+T/2+Math.cos(ang)*12,sy+T/2+1+Math.sin(ang)*9);
      ctx.stroke();
    }
    ctx.restore();
    // Highlight
    ctx.fillStyle='rgba(200,180,130,.25)';
    ctx.beginPath(); ctx.ellipse(sx+T/2-2,sy+T/2-2,4,3,0,0,Math.PI*2); ctx.fill();

  } else if(t===BL.OUTPOST||t===BL.OUTPOST_WALL) {
    if(t===BL.OUTPOST_WALL){
      // Adobe/adobe brick wall — warm reddish-brown with mortar lines
      ctx.fillStyle='#6a3018'; ctx.fillRect(sx,sy,T,T);
      ctx.fillStyle='#7a3c20'; ctx.fillRect(sx+1,sy+1,T-2,T-2);
      // Brick pattern — offset courses
      const row=(ty%2===0);
      ctx.fillStyle='rgba(40,15,5,.35)';
      if(row){ ctx.fillRect(sx+T/2,sy+1,1,T-2); ctx.fillRect(sx+1,sy+T/2,T-2,1); }
      else  { ctx.fillRect(sx+T/4,sy+1,1,T-2); ctx.fillRect(sx+3*T/4,sy+1,1,T-2); ctx.fillRect(sx+1,sy+T/2,T-2,1); }
      // Adobe surface pitting
      ctx.fillStyle='rgba(80,30,10,.2)';
      if(h%3===0) ctx.fillRect(sx+(h%10)+3,sy+(h2%8)+4,3,2);
      // Top-lit highlight
      ctx.fillStyle='rgba(200,130,70,.12)';
      ctx.fillRect(sx+1,sy+1,T-2,3);
    } else {
      // Outpost floor — packed dirt with scattered stone flags
      ctx.fillStyle='#907060'; ctx.fillRect(sx,sy,T,T);
      // Stone flag alternating
      if((tx+ty)%2===0){
        ctx.fillStyle='#7a5e4c'; ctx.fillRect(sx+2,sy+2,T-4,T-4);
        // Flag grout lines
        ctx.fillStyle='rgba(50,30,15,.3)';
        ctx.fillRect(sx+2,sy+T/2,T-4,1); ctx.fillRect(sx+T/2,sy+2,1,T-4);
      } else {
        ctx.fillStyle='#846858'; ctx.fillRect(sx+1,sy+1,T-2,T-2);
      }
      // Grit
      if(h%4===0){ctx.fillStyle='rgba(80,55,30,.25)';ctx.fillRect(sx+(h%14)+2,sy+(h2%14)+2,2,2);}
    }

  } else if(t===BL.BL_BONE) {
    // Bone scatter — multiple bones arranged naturally
    ctx.fillStyle='#a09070'; ctx.fillRect(sx,sy,T,T); // dusty ground
    ctx.fillStyle='#ddd0b8';
    // Long bone horizontal — slight angle
    ctx.save(); ctx.translate(sx+T/2,sy+T/2);
    ctx.rotate(0.3);
    ctx.fillRect(-9,-2,18,4);
    // Knobbed ends
    ctx.beginPath(); ctx.ellipse(-9,0,3,4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9,0,3,4,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Second smaller bone — perpendicular
    ctx.fillStyle='#c8c0a8';
    ctx.save(); ctx.translate(sx+T/2+3,sy+T/2-4);
    ctx.rotate(-0.8);
    ctx.fillRect(-6,-1.5,12,3);
    ctx.beginPath(); ctx.ellipse(-6,0,2,3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6,0,2,3,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Skull fragment
    ctx.fillStyle='#d8ceb8';
    ctx.beginPath(); ctx.ellipse(sx+T/2-4,sy+T/2+5,4,3,0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#181210';
    ctx.beginPath(); ctx.ellipse(sx+T/2-4,sy+T/2+6,2,1.5,0,0,Math.PI*2); ctx.fill();

  } else if(t===BL.BL_COPPER) {
    ctx.fillStyle='#8a4820'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#7a3c18'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    // Copper vein seam — irregular blob
    ctx.fillStyle='#d07030'; ctx.fillRect(sx+5,sy+6,9,7);
    ctx.fillStyle='#e09040'; ctx.fillRect(sx+7,sy+7,6,5);
    ctx.fillStyle='#f0a050'; ctx.fillRect(sx+8,sy+8,4,3); // bright core
    ctx.fillStyle='#b05820'; ctx.fillRect(sx+T-11,sy+8,6,5);
    // Verdigris oxidation
    ctx.fillStyle='rgba(30,110,50,.4)'; ctx.fillRect(sx+9,sy+11,4,2); ctx.fillRect(sx+T-10,sy+10,3,2);
    // Rock matrix
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(sx+T-8,sy+T-8,6,6);
    // Pickaxe score line
    ctx.save();
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+6,sy+5); ctx.lineTo(sx+T-7,sy+T-7); ctx.stroke();
    ctx.restore();

  } else if(t===BL.BL_IRON) {
    ctx.fillStyle='#384050'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#2e3444'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    // Iron banding — thick dark stripes
    ctx.fillStyle='#6878a0'; ctx.fillRect(sx+4,sy+7,T-8,4);
    ctx.fillStyle='#8090b8'; ctx.fillRect(sx+4,sy+8,T-8,2);
    ctx.fillStyle='#505870'; ctx.fillRect(sx+4,sy+14,T-8,4);
    ctx.fillStyle='#607088'; ctx.fillRect(sx+4,sy+15,T-8,2);
    // Metallic highlight
    ctx.fillStyle='rgba(180,200,230,.25)'; ctx.fillRect(sx+6,sy+8,4,1); ctx.fillRect(sx+6,sy+15,3,1);
    // Matrix shadow
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(sx+3,sy+T-5,T-6,4);
    ctx.save();
    ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+7,sy+5); ctx.lineTo(sx+T-6,sy+T-6); ctx.stroke();
    ctx.restore();

  } else if(t===BL.BL_SILVER) {
    ctx.fillStyle='#8a9098'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#9aa0a8'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const sp=0.4+Math.sin(Date.now()*.0018+tx*0.7)*0.35;
    // Silver vein — bright irregular mass
    ctx.fillStyle=`rgba(200,215,240,${sp})`; ctx.fillRect(sx+5,sy+6,T-10,5);
    ctx.fillStyle=`rgba(230,242,255,${sp*0.8})`; ctx.fillRect(sx+7,sy+7,T-14,3);
    ctx.fillStyle=`rgba(160,180,220,${sp})`; ctx.fillRect(sx+6,sy+13,T-12,4);
    // Sparkle points
    ctx.fillStyle=`rgba(255,255,255,${sp})`; ctx.fillRect(sx+9,sy+7,2,1); ctx.fillRect(sx+T/2,sy+14,1,2);
    // Matrix shadow
    ctx.fillStyle='rgba(50,60,80,.2)'; ctx.fillRect(sx+3,sy+T-5,T-6,4);

  } else if(t===BL.BL_OBSIDIAN) {
    ctx.fillStyle='#0c0010'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#100015'; ctx.fillRect(sx+3,sy+3,T-6,T-6);
    const gl=0.35+0.28*Math.sin(Date.now()*.0025+tx*1.1+ty*0.7);
    // Glassy body — obsidian has a conchoidal fracture pattern
    ctx.fillStyle=`rgba(70,8,150,${gl*0.55})`; ctx.fillRect(sx+5,sy+5,T-10,T-10);
    // Fracture facets
    ctx.save();
    ctx.strokeStyle=`rgba(150,70,240,${gl*0.7})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx+8,sy+6); ctx.lineTo(sx+T-8,sy+T-9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+T-9,sy+7); ctx.lineTo(sx+9,sy+T-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx+T/2,sy+5); ctx.lineTo(sx+5,sy+T/2); ctx.stroke();
    ctx.restore();
    // Bright reflection point
    ctx.fillStyle=`rgba(220,160,255,${gl*0.55})`; ctx.fillRect(sx+T/2-1,sy+T/2-1,3,3);
    ctx.fillStyle=`rgba(255,220,255,${gl*0.8})`; ctx.fillRect(sx+T/2,sy+T/2,1,1);
    // Edge depth
    ctx.fillStyle='rgba(0,0,0,.4)'; ctx.fillRect(sx+T-4,sy,4,T); ctx.fillRect(sx,sy+T-4,T,4);

  } else if(t===BL.BL_EXIT) {
    const pt=Date.now()*.0022+tx*0.6+ty*1.1;
    const pulse=0.3+0.28*Math.sin(pt);
    ctx.fillStyle=`rgba(60,200,160,${pulse})`; ctx.fillRect(sx,sy,T,T);
    ctx.save();
    ctx.strokeStyle=`rgba(100,240,200,${0.5+0.3*Math.sin(pt*1.4)})`; ctx.lineWidth=2;
    ctx.strokeRect(sx+2,sy+2,T-4,T-4);
    ctx.restore();
    ctx.fillStyle=`rgba(180,255,230,${0.25+0.2*Math.sin(pt*2)})`; ctx.fillRect(sx+6,sy+6,T-12,T-12);
    ctx.fillStyle=`rgba(255,255,255,${0.6+0.3*Math.sin(pt*1.8)})`;
    ctx.beginPath();
    ctx.moveTo(sx+T/2-6,sy+T/2); ctx.lineTo(sx+T/2+3,sy+T/2-6); ctx.lineTo(sx+T/2+3,sy+T/2+6);
    ctx.closePath(); ctx.fill();

  } else if(t===BL.ASH||t===0) { // fallback for 0
    ctx.fillStyle='#686058'; ctx.fillRect(sx,sy,T,T);
    if((tx*3+ty*7)%5===0){ctx.fillStyle='rgba(100,90,80,.4)';ctx.fillRect(sx+4,sy+6,3,2);}

  } else if(t===BL.TOXIC_VENT) {
    ctx.fillStyle='#3a4810'; ctx.fillRect(sx,sy,T,T);
    const bub=Date.now()*.003+tx*1.7+ty*2.3;
    // Toxic ground stain — expanding circle
    ctx.fillStyle=`rgba(60,140,8,${0.35+0.2*Math.sin(bub)})`; ctx.fillRect(sx+2,sy+2,T-4,T-4);
    ctx.fillStyle=`rgba(80,160,10,${0.4+0.25*Math.sin(bub+0.8)})`; ctx.fillRect(sx+5,sy+5,T-10,T-10);
    // Vent crack
    ctx.fillStyle='#111a04';
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+3,7,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#070e02';
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+3,5,3,0,0,Math.PI*2); ctx.fill();
    // Sulfur crust ring
    ctx.save();
    ctx.strokeStyle=`rgba(160,200,20,${0.3+0.2*Math.sin(bub+1)})`; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(sx+T/2,sy+T/2+3,9,6,0,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    // Bubbling gas
    for(let b=0;b<3;b++){
      const bx=sx+7+b*7, by=sy+T/2-1+Math.sin(bub+b*1.1)*3.5;
      const ba=0.55+0.3*Math.sin(bub+b*1.6);
      ctx.fillStyle=`rgba(130,220,20,${ba})`;
      ctx.beginPath(); ctx.arc(bx,by,2+Math.abs(Math.sin(bub+b)),0,Math.PI*2); ctx.fill();
    }

  } else if(t===BL.SETTLEMENT) {
    // Ruined settlement floor — worn flagstone
    ctx.fillStyle='#4a3830'; ctx.fillRect(sx,sy,T,T);
    // Flagstone pattern — irregular slabs
    const fc = (tx+ty)%3;
    if(fc===0){ ctx.fillStyle='#5a4840'; ctx.fillRect(sx+1,sy+1,T-3,T/2-1); ctx.fillStyle='#523e38'; ctx.fillRect(sx+1,sy+T/2,T-3,T/2-1); }
    else if(fc===1){ ctx.fillStyle='#504040'; ctx.fillRect(sx+1,sy+1,T/2-1,T-3); ctx.fillStyle='#483838'; ctx.fillRect(sx+T/2,sy+1,T/2-1,T-3); }
    else{ ctx.fillStyle='#4e3c34'; ctx.fillRect(sx+2,sy+2,T-4,T-4); }
    // Grout lines
    ctx.fillStyle='rgba(20,12,8,.5)';
    ctx.fillRect(sx,sy+T/2,T,1); ctx.fillRect(sx+T/2,sy,1,T);
    // Rubble and grit
    if(h%5===0){ ctx.fillStyle='rgba(100,80,55,.4)'; ctx.fillRect(sx+(h%14)+1,sy+(h2%14)+1,3,2); }

  } else if(t===BL.SETTLEMENT_WALL) {
    // Crumbling adobe/stone wall — chunky and detailed
    ctx.fillStyle='#201408'; ctx.fillRect(sx,sy,T,T);
    ctx.fillStyle='#2e1c10'; ctx.fillRect(sx+1,sy+1,T-2,T-2);
    // Stone block courses — 3 rows
    const wallColors=['#3c2416','#48281a','#402018'];
    for(let r=0;r<3;r++){
      ctx.fillStyle=wallColors[r];
      const ry=sy+2+r*9;
      const off=(r+ty)%2===0?0:T/4;
      ctx.fillRect(sx+2+off,ry,T/2-3,7);
      ctx.fillRect(sx+2+off+T/2,ry,T/2-3,7);
    }
    // Mortar lines
    ctx.fillStyle='rgba(10,5,2,.45)';
    ctx.fillRect(sx+2,sy+9,T-4,1); ctx.fillRect(sx+2,sy+18,T-4,1);
    ctx.fillRect(sx+T/2,sy+2,1,8); ctx.fillRect(sx+T/2,sy+11,1,7);
    // Crumbled top — rubble chunks
    ctx.fillStyle='#3a2010';
    if(h%3===0) ctx.fillRect(sx+(h%8)+2,sy+1,4,3);
    if(h2%4===0) ctx.fillRect(sx+(h2%10)+4,sy,3,3);
    // Dirt/debris at base
    ctx.fillStyle='rgba(80,50,20,.3)'; ctx.fillRect(sx+1,sy+T-4,T-2,3);
    // Top highlight
    ctx.fillStyle='rgba(180,120,60,.1)'; ctx.fillRect(sx+1,sy+1,T-2,2);

  } else {
    // Fallback
    const c=BL_TC[t]||BL_TC[BL.CRACKED];
    ctx.fillStyle=c[0]; ctx.fillRect(sx,sy,T,T);
  }
}