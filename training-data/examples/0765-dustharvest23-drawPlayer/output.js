function drawPlayer() {
  const sx=Math.round(player.x-gameState.camera.x);
  const sy=Math.round(player.y-gameState.camera.y);
  const bob=Math.round(Math.sin(player.walkFrame*Math.PI/2)*(player.sprinting?3:1.5));
  const f=player.facing;

  // ── On-boat rendering — character seated in hull, lower body hidden ──────
  if (gameState.inOcean && player._onBoat && hasBoat()) {
    const tier = getBoatTier();
    const tierIdx = BOAT_TIERS.findIndex(b=>b.id===tier.id);
    const hullColors=['#7a4e28','#5a3a1c','#4a2e18','#3a2210'];
    const deckColors=['#8a5e38','#6a4424','#5a3820','#4a2c18'];
    const hc = hullColors[Math.min(tierIdx,3)];
    const dc = deckColors[Math.min(tierIdx,3)];
    const boatBob = Math.sin(Date.now()*0.0012)*1.5;

    // Boat visual size (matches drawOceanBoat)
    const bw=[40,52,64,76][Math.min(tierIdx,3)];
    const bh=[56,72,88,100][Math.min(tierIdx,3)];
    const boatX = gameState.boatX - gameState.camera.x - bw/2;
    const boatY = gameState.boatY - gameState.camera.y - bh/2;

    ctx.save();
    ctx.fillStyle='#101010'; ctx.fillRect(boatX-2,boatY-2+boatBob,bw+4,bh+4);
    ctx.fillStyle=hc; ctx.fillRect(boatX,boatY+boatBob,bw,bh);
    ctx.fillStyle=dc; ctx.fillRect(boatX+3,boatY+3+boatBob,bw-6,bh-6);
    ctx.fillStyle='rgba(0,0,0,.18)';
    for(let i=0;i<3;i++) ctx.fillRect(boatX+3,boatY+3+i*Math.floor((bh-6)/3)+boatBob,bw-6,1);
    // Gunwales (hide player legs)
    ctx.fillStyle=hc;
    ctx.fillRect(boatX,boatY+boatBob,bw,5);
    ctx.fillRect(boatX,boatY+bh-5+boatBob,bw,5);
    ctx.fillRect(boatX,boatY+boatBob,5,bh);
    ctx.fillRect(boatX+bw-5,boatY+boatBob,5,bh);
    ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(boatX,boatY+boatBob,bw,2);
    // Mast
    if(tierIdx>=1){
      const mx=boatX+bw/2-1, my=boatY-16+boatBob;
      ctx.fillStyle='#2e1c0c'; ctx.fillRect(mx,my,2,bh+16);
      const bt=Date.now()*0.001, sw=Math.sin(bt)*3;
      ctx.fillStyle='rgba(220,210,180,.72)';
      ctx.beginPath();
      ctx.moveTo(mx+2,my+3); ctx.lineTo(mx+2+12+sw,my+10); ctx.lineTo(mx+2+10+sw,my+32); ctx.lineTo(mx+2,my+36);
      ctx.closePath(); ctx.fill();
    }
    if(tierIdx>=2){
      const mx2=boatX+bw/2, my2=boatY+bh/2-10+boatBob;
      ctx.fillStyle='#2e1c0c'; ctx.fillRect(mx2,my2,2,26);
      const sw2=Math.sin(Date.now()*0.0009+1.5)*2;
      ctx.fillStyle='rgba(210,200,170,.62)';
      ctx.beginPath();
      ctx.moveTo(mx2+2,my2+2); ctx.lineTo(mx2+2+8+sw2,my2+7); ctx.lineTo(mx2+2+7+sw2,my2+18); ctx.lineTo(mx2+2,my2+22);
      ctx.closePath(); ctx.fill();
    }
    if(tierIdx>=3){
      ctx.fillStyle='#282828';
      ctx.fillRect(boatX+1,boatY+bh/2-3+boatBob,5,5);
      ctx.fillRect(boatX+bw-6,boatY+bh/2-3+boatBob,5,5);
    }

    // Draw player upper body (seated) centered on boat
    const seated_bob = boatBob + Math.round(Math.sin(player.walkFrame*Math.PI/2)*0.8);
    const OL='#181818';
    const SKIN=['#885848','#d89878','#f8d8b8'];
    const SHIRT=player.sprinting?['#5a3818','#8a5828','#c07840']:['#6a4820','#9a6830','#d09050'];
    const HAT=['#1e1008','#3a2408','#5a3818'];
    const HATBAND=['#3a1008','#6a2010','#9a3818'];
    const SUSP=['#2a1008','#4a2010'];
    const p2=(x,y,w,h,ramp)=>{
      ctx.fillStyle=OL; ctx.fillRect(x-1,y-1,w+2,h+2);
      ctx.fillStyle=ramp[0]; ctx.fillRect(x,y,w,h);
      ctx.fillStyle=ramp[1]; ctx.fillRect(x,y,w-1,h-1);
      ctx.fillStyle=ramp[2]; ctx.fillRect(x,y,w-2,2);
      ctx.fillStyle=ramp[2]; ctx.fillRect(x,y,2,h-2);
    };

    p2(sx-7,sy-14+seated_bob,14,10,SHIRT);
    ctx.fillStyle=SUSP[0]; ctx.fillRect(sx-3,sy-14+seated_bob,2,10); ctx.fillRect(sx+1,sy-14+seated_bob,2,10);
    ctx.fillStyle=SUSP[1]; ctx.fillRect(sx-3,sy-14+seated_bob,1,10); ctx.fillRect(sx+1,sy-14+seated_bob,1,10);
    p2(sx-11,sy-8+seated_bob,5,4,SHIRT);
    p2(sx+6,sy-8+seated_bob,5,4,SHIRT);
    p2(sx-11,sy-5+seated_bob,4,3,SKIN);
    p2(sx+7,sy-5+seated_bob,4,3,SKIN);
    p2(sx-2,sy-18+seated_bob,5,5,SKIN);
    p2(sx-5,sy-28+seated_bob,10,11,SKIN);
    ctx.fillStyle=OL; ctx.fillRect(sx-3,sy-25+seated_bob,3,3); ctx.fillRect(sx+1,sy-25+seated_bob,3,3);
    ctx.fillStyle='#284838'; ctx.fillRect(sx-2,sy-25+seated_bob,2,2); ctx.fillRect(sx+2,sy-25+seated_bob,2,2);
    ctx.fillStyle=OL; ctx.fillRect(sx-2,sy-25+seated_bob,1,1); ctx.fillRect(sx+2,sy-25+seated_bob,1,1);
    ctx.fillStyle='#f8f8f8'; ctx.fillRect(sx-1,sy-26+seated_bob,1,1); ctx.fillRect(sx+3,sy-26+seated_bob,1,1);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-3,sy-27+seated_bob,3,1); ctx.fillRect(sx+1,sy-27+seated_bob,3,1);
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx,sy-23+seated_bob,2,3);
    ctx.fillStyle=OL; ctx.fillRect(sx-2,sy-19+seated_bob,5,1);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx-2,sy-19+seated_bob,2,1); ctx.fillRect(sx+2,sy-19+seated_bob,1,1);
    p2(sx-10,sy-31+seated_bob,20,3,HAT);
    p2(sx-5,sy-39+seated_bob,10,9,HAT);
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-32+seated_bob,10,3);
    ctx.fillStyle=HATBAND[0]; ctx.fillRect(sx-5,sy-32+seated_bob,10,2);
    ctx.fillStyle=HATBAND[1]; ctx.fillRect(sx-5,sy-32+seated_bob,7,1);
    ctx.fillStyle=HATBAND[2]; ctx.fillRect(sx-5,sy-32+seated_bob,4,1);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-1,sy-39+seated_bob,2,9);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-10,sy-31+seated_bob,20,1);

    // Boat name tag
    const bName=['Unnamed','Prairie Wind','Frontier','Iron Shore'];
    ctx.font='bold 6px sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillText(bName[Math.min(tierIdx,3)],boatX+bw/2+1,boatY+bh+9+boatBob);
    ctx.fillStyle='#d0c090'; ctx.fillText(bName[Math.min(tierIdx,3)],boatX+bw/2,boatY+bh+8+boatBob);

    ctx.restore();
    return; // skip normal player draw
  }

  // ── Wading effect — ankle-deep water on WATER tiles ────────────────────────
  const _wading = gameState.inOcean && (()=>{
    const ptx=Math.floor(player.x/OC_T), pty=Math.floor(player.y/OC_T);
    const t=getOCT(ptx,pty);
    return t===OC.WATER;
  })();

  // ── Colour palette (shared across all directions) ─────────────────────────
  const OL    = '#181818';
  const SKIN  = ['#885848','#d89878','#f8d8b8'];
  const HAIR  = ['#281818','#603828','#a06840'];
  const SHIRT = player.sprinting
    ? ['#5a3818','#8a5828','#c07840']
    : ['#6a4820','#9a6830','#d09050'];
  const PANTS = ['#182030','#283848','#485868'];
  const BOOT  = ['#1a1008','#3a2010','#5a3820'];
  const HAT   = ['#1e1008','#3a2408','#5a3818'];
  const HATBAND = ['#3a1008','#6a2010','#9a3818'];
  const SUSP  = ['#2a1008','#4a2010'];
  const TOOLS = {
    till:    ['#3a2808','#6a4818','#a07830'],
    water:   ['#102850','#204880','#4080c0'],
    plant:   ['#1a2808','#2a4810','#488028'],
    harvest: ['#402808','#7a5010','#c09030'],
  };

  // Shaded outlined rect helper
  const p = (x,y,w,h,ramp) => {
    ctx.fillStyle=OL;      ctx.fillRect(x-1,y-1,w+2,h+2);
    ctx.fillStyle=ramp[0]; ctx.fillRect(x,  y,  w,  h  );
    ctx.fillStyle=ramp[1]; ctx.fillRect(x,  y,  w-1,h-1);
    ctx.fillStyle=ramp[2]; ctx.fillRect(x,  y,  w-2,2  );
    ctx.fillStyle=ramp[2]; ctx.fillRect(x,  y,  2,  h-2);
  };
  // Flat outlined rect
  const po = (x,y,w,h,col) => {
    ctx.fillStyle=OL;  ctx.fillRect(x-1,y-1,w+2,h+2);
    ctx.fillStyle=col; ctx.fillRect(x,y,w,h);
  };

  // Walk stride — 4 frames: 0=neutral, 1=L-fwd, 2=neutral, 3=R-fwd
  const wf = player.walkFrame; // 0-3
  // Leg offsets: positive = forward (down toward viewer), negative = back
  const lLeg = (wf===1 ?  4 : wf===3 ? -3 : 0); // left leg
  const rLeg = (wf===1 ? -3 : wf===3 ?  4 : 0); // right leg
  // Arm swing — opposite to legs
  const lArm = -lLeg;
  const rArm = -rLeg;
  // Side-view stride: near leg forward, far leg back
  const nearLeg = (wf===1 ?  5 : wf===3 ? -4 : 0);
  const farLeg  = (wf===1 ? -4 : wf===3 ?  5 : 0);
  const nearArm = -nearLeg;
  const farArm  = -farLeg;

  // Ground shadow
  ctx.globalAlpha=.3; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx, sy+player.h/2, 9, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  // ════════════════════════════════════════════════════════
  //  FACING DOWN  (front-facing — original view, improved)
  // ════════════════════════════════════════════════════════
  if (f === 'down') {

    // ── Boots / wading ──
    if (_wading) {
      p(sx-6, sy+4+lLeg+bob, 5,6, BOOT);
      p(sx+1, sy+4+rLeg+bob, 5,6, BOOT);
      const wt=Date.now()*0.004;
      const wa=0.55+0.25*Math.sin(wt+sx*0.1);
      ctx.fillStyle=`rgba(30,112,160,${wa})`; ctx.fillRect(sx-8,sy+4+bob,18,7);
      ctx.fillStyle=`rgba(200,230,255,${0.4+0.2*Math.sin(wt*1.3+sy*0.08)})`;
      ctx.fillRect(sx-8,sy+4+bob,18,1);
      ctx.strokeStyle=`rgba(100,190,220,${0.3+0.15*Math.sin(wt)})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.ellipse(sx, sy+8+bob, 8+Math.sin(wt)*1.5, 3, 0, 0, Math.PI*2); ctx.stroke();
    } else {
      p(sx-6, sy+4+lLeg+bob, 5,6, BOOT);
      p(sx+1, sy+4+rLeg+bob, 5,6, BOOT);
      ctx.fillStyle=OL;
      ctx.fillRect(sx-7, sy+8+lLeg+bob, 5,2);
      ctx.fillRect(sx+1, sy+8+rLeg+bob, 5,2);
    }

    // ── Legs ──
    p(sx-6, sy-4+lLeg+bob, 5,10, PANTS);
    p(sx+1, sy-4+rLeg+bob, 5,10, PANTS);
    ctx.fillStyle=PANTS[0];
    ctx.fillRect(sx-5, sy+2+lLeg+bob, 4,3); // left knee shadow
    ctx.fillRect(sx+2, sy+2+rLeg+bob, 4,3); // right knee shadow

    // ── Body ──
    p(sx-7, sy-14+bob, 14,12, SHIRT);
    ctx.fillStyle=SUSP[0]; ctx.fillRect(sx-3,sy-14+bob,2,12); ctx.fillRect(sx+1,sy-14+bob,2,12);
    ctx.fillStyle=SUSP[1]; ctx.fillRect(sx-3,sy-14+bob,1,12); ctx.fillRect(sx+1,sy-14+bob,1,12);

    // ── Arms — swing front/back with stride ──
    // Left arm (player-left = screen-left for down-facing)
    p(sx-10, sy-12+lArm+bob, 4,9, SHIRT);
    p(sx-10, sy-5+lArm+bob,  4,5, SKIN);  // forearm
    // Right arm
    p(sx+6,  sy-12+rArm+bob, 4,9, SHIRT);
    p(sx+6,  sy-5+rArm+bob,  4,5, SKIN);

    // ── Neck ──
    p(sx-2, sy-18+bob, 5,5, SKIN);

    // ── Head ──
    p(sx-5, sy-28+bob, 10,11, SKIN);
    // Eyes
    ctx.fillStyle=OL;      ctx.fillRect(sx-3,sy-25+bob,3,3); ctx.fillRect(sx+1,sy-25+bob,3,3);
    ctx.fillStyle='#284838'; ctx.fillRect(sx-2,sy-25+bob,2,2); ctx.fillRect(sx+2,sy-25+bob,2,2);
    ctx.fillStyle=OL;      ctx.fillRect(sx-2,sy-25+bob,1,1); ctx.fillRect(sx+2,sy-25+bob,1,1);
    ctx.fillStyle='#f8f8f8'; ctx.fillRect(sx-1,sy-26+bob,1,1); ctx.fillRect(sx+3,sy-26+bob,1,1);
    // Brows
    ctx.fillStyle=HAIR[0]; ctx.fillRect(sx-3,sy-27+bob,3,1); ctx.fillRect(sx+1,sy-27+bob,3,1);
    // Nose
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx,sy-23+bob,2,3);
    // Mouth
    ctx.fillStyle=OL; ctx.fillRect(sx-2,sy-19+bob,5,1);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx-2,sy-19+bob,2,1); ctx.fillRect(sx+2,sy-19+bob,1,1);

    // ── Hat brim + crown ──
    p(sx-10, sy-31+bob, 20,3, HAT);
    p(sx-5,  sy-39+bob, 10,9, HAT);
    ctx.fillStyle=OL;        ctx.fillRect(sx-5,sy-32+bob,10,3);
    ctx.fillStyle=HATBAND[0]; ctx.fillRect(sx-5,sy-32+bob,10,2);
    ctx.fillStyle=HATBAND[1]; ctx.fillRect(sx-5,sy-32+bob,7,1);
    ctx.fillStyle=HATBAND[2]; ctx.fillRect(sx-5,sy-32+bob,4,1);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-1,sy-39+bob,2,9);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-10,sy-31+bob,20,1);

    // ── Tool ──
    const toolD = TOOLS[player.tool]||TOOLS.till;
    p(sx-1, sy-4+bob, 3,14, toolD);
    // tool head at bottom
    p(sx-4, sy+8+bob, 9,3, toolD);

  // ════════════════════════════════════════════════════════
  //  FACING UP  (back-facing)
  // ════════════════════════════════════════════════════════
  } else if (f === 'up') {

    // ── Boots ──
    p(sx-6, sy+4+lLeg+bob, 5,6, BOOT);
    p(sx+1, sy+4+rLeg+bob, 5,6, BOOT);
    // No toe caps from back — show heel
    ctx.fillStyle=BOOT[0];
    ctx.fillRect(sx-7, sy+4+lLeg+bob, 2,6);
    ctx.fillRect(sx+6, sy+4+rLeg+bob, 2,6);

    // ── Legs ──
    p(sx-6, sy-4+lLeg+bob, 5,10, PANTS);
    p(sx+1, sy-4+rLeg+bob, 5,10, PANTS);

    // ── Body — back view: slightly narrower, back pockets implied ──
    p(sx-7, sy-14+bob, 14,12, SHIRT);
    // Suspender straps from behind — run up back
    ctx.fillStyle=SUSP[0]; ctx.fillRect(sx-4,sy-14+bob,2,12); ctx.fillRect(sx+2,sy-14+bob,2,12);
    ctx.fillStyle=SUSP[1]; ctx.fillRect(sx-4,sy-14+bob,1,12); ctx.fillRect(sx+2,sy-14+bob,1,12);
    // Back shirt seam
    ctx.fillStyle=SHIRT[0]; ctx.fillRect(sx-1,sy-14+bob,2,12);

    // ── Arms swing ──
    p(sx-10, sy-12+lArm+bob, 4,9, SHIRT);
    p(sx-10, sy-5+lArm+bob,  4,5, SKIN);
    p(sx+6,  sy-12+rArm+bob, 4,9, SHIRT);
    p(sx+6,  sy-5+rArm+bob,  4,5, SKIN);

    // ── Neck — back, slightly narrower ──
    ctx.fillStyle=OL; ctx.fillRect(sx-2,sy-19+bob,5,6);
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx-1,sy-18+bob,3,5);
    // Hair at back of neck
    ctx.fillStyle=HAIR[1]; ctx.fillRect(sx-1,sy-19+bob,3,3);

    // ── Head — back of head, no face features ──
    p(sx-5, sy-28+bob, 10,11, SKIN);
    // Hair covers most of back of head
    ctx.fillStyle=HAIR[1];
    ctx.fillRect(sx-4, sy-27+bob, 8,8);
    ctx.fillStyle=HAIR[0];
    ctx.fillRect(sx-4, sy-19+bob, 8,2); // hair at nape

    // ── Hat — from back: brim visible both sides, crown prominent ──
    // Back brim extends further on back view
    p(sx-10, sy-31+bob, 20,3, HAT);
    p(sx-5,  sy-39+bob, 10,9, HAT);
    ctx.fillStyle=OL;        ctx.fillRect(sx-5,sy-32+bob,10,3);
    ctx.fillStyle=HATBAND[0]; ctx.fillRect(sx-5,sy-32+bob,10,2);
    ctx.fillStyle=HATBAND[1]; ctx.fillRect(sx-5,sy-32+bob,7,1);
    // Crown crease (different angle from back)
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-4,sy-39+bob,8,9);
    ctx.fillStyle=HAT[1]; ctx.fillRect(sx-2,sy-39+bob,4,9);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-10,sy-31+bob,20,1);

    // ── Tool held up/away ──
    const toolU = TOOLS[player.tool]||TOOLS.till;
    p(sx-1, sy-42+bob, 3,14, toolU);
    p(sx-4, sy-42+bob, 9, 3, toolU);

  // ════════════════════════════════════════════════════════
  //  FACING RIGHT  (right-facing side profile)
  //  Side walk: legs/arms swing on X axis (forward/back).
  //  wf 0=neutral 1=near-fwd 2=neutral 3=near-back
  //  Near leg/arm are in front of body; far are behind.
  // ════════════════════════════════════════════════════════
  } else if (f === 'right') {
    // Side-walk X offsets — legs swing forward(+) and back(-) along direction of travel
    // nearLegX: near leg swings forward on frame 1, back on frame 3
    const nearLegX = (wf===1 ?  5 : wf===3 ? -5 : 0);
    const farLegX  = -nearLegX;                     // far leg opposite
    const nearArmX = -nearLegX;                     // arms counter-swing
    const farArmX  =  nearLegX;
    // Hip bob: body rises slightly at mid-stride (frames 0,2)
    const hipBob = (wf===0||wf===2) ? -1 : 0;

    // ── Far leg — behind body, drawn first ──
    // Upper leg
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+farLegX-1, sy-5+bob+hipBob-1, 6,12);
    ctx.fillStyle=PANTS[0]; ctx.fillRect(sx-2+farLegX,   sy-5+bob+hipBob,   4,10);
    ctx.fillStyle=PANTS[1]; ctx.fillRect(sx-2+farLegX,   sy-5+bob+hipBob,   3, 9);
    // Lower leg / boot
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+farLegX-1, sy+4+bob+hipBob-1, 6,7);
    ctx.fillStyle=BOOT[0]; ctx.fillRect(sx-2+farLegX,   sy+4+bob+hipBob,   4,6);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-2+farLegX,   sy+4+bob+hipBob,   3,5);
    // Far toe (pointing right, back foot smaller)
    ctx.fillStyle=OL;     ctx.fillRect(sx+1+farLegX,   sy+9+bob+hipBob,   4,2);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx+2+farLegX,   sy+9+bob+hipBob,   2,2);

    // ── Far arm — behind body ──
    ctx.fillStyle=SHIRT[0]; ctx.fillRect(sx-1+farArmX, sy-13+bob+hipBob, 4, 8);
    ctx.fillStyle=SKIN[0];  ctx.fillRect(sx-1+farArmX, sy -6+bob+hipBob, 3, 5);

    // ── Body — side profile 9px wide ──
    p(sx-4, sy-14+bob+hipBob, 9,12, SHIRT);
    ctx.fillStyle=SUSP[0]; ctx.fillRect(sx,sy-14+bob+hipBob,2,12);
    ctx.fillStyle=SUSP[1]; ctx.fillRect(sx,sy-14+bob+hipBob,1,12);

    // ── Near leg — in front of body ──
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+nearLegX-1, sy-5+bob+hipBob-1, 6,12);
    ctx.fillStyle=PANTS[0]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   4,10);
    ctx.fillStyle=PANTS[1]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   3, 9);
    ctx.fillStyle=PANTS[2]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   2, 1); // highlight
    // Boot
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+nearLegX-1, sy+4+bob+hipBob-1, 7,8);
    ctx.fillStyle=BOOT[0]; ctx.fillRect(sx-2+nearLegX,   sy+4+bob+hipBob,   5,6);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-2+nearLegX,   sy+4+bob+hipBob,   4,5);
    ctx.fillStyle=BOOT[2]; ctx.fillRect(sx-2+nearLegX,   sy+4+bob+hipBob,   3,1); // toe highlight
    // Toe cap — extends further right for near foot
    ctx.fillStyle=OL;     ctx.fillRect(sx+2+nearLegX,   sy+8+bob+hipBob,   4,3);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx+3+nearLegX,   sy+9+bob+hipBob,   2,2);

    // ── Near arm — in front ──
    p(sx+2+nearArmX, sy-13+bob+hipBob, 4,9, SHIRT);
    p(sx+2+nearArmX, sy -5+bob+hipBob, 4,5, SKIN);

    // ── Neck — profile ──
    p(sx-1, sy-18+bob+hipBob, 4,5, SKIN);

    // ── Head — side profile ──
    p(sx-3, sy-28+bob+hipBob, 9,11, SKIN);
    // Eye
    ctx.fillStyle=OL;       ctx.fillRect(sx+2,sy-25+bob+hipBob,3,3);
    ctx.fillStyle='#284838'; ctx.fillRect(sx+3,sy-25+bob+hipBob,2,2);
    ctx.fillStyle=OL;       ctx.fillRect(sx+3,sy-25+bob+hipBob,1,1);
    ctx.fillStyle='#f8f8f8'; ctx.fillRect(sx+4,sy-26+bob+hipBob,1,1);
    // Brow
    ctx.fillStyle=HAIR[0]; ctx.fillRect(sx+2,sy-27+bob+hipBob,4,1);
    // Nose protrudes right
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx+5,sy-24+bob+hipBob,3,2);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx+5,sy-23+bob+hipBob,2,1);
    // Mouth
    ctx.fillStyle=OL;     ctx.fillRect(sx+4,sy-20+bob+hipBob,2,1);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx+4,sy-20+bob+hipBob,1,1);
    // Ear (far side stub)
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx-3,sy-25+bob+hipBob,2,3);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx-3,sy-24+bob+hipBob,1,2);
    // Hair at back of head
    ctx.fillStyle=HAIR[1]; ctx.fillRect(sx-3,sy-27+bob+hipBob,3,7);

    // ── Hat — side profile, brim strong to the right ──
    ctx.fillStyle=OL;     ctx.fillRect(sx-7,sy-31+bob+hipBob,22,4);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-6,sy-31+bob+hipBob,20,3);
    ctx.fillStyle=HAT[1]; ctx.fillRect(sx-5,sy-31+bob+hipBob,18,2);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-5,sy-31+bob+hipBob,18,1);
    ctx.fillStyle=OL;     ctx.fillRect(sx-3,sy-40+bob+hipBob,10,10);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-2,sy-39+bob+hipBob, 8, 9);
    ctx.fillStyle=HAT[1]; ctx.fillRect(sx-1,sy-39+bob+hipBob, 6, 8);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-1,sy-39+bob+hipBob, 5, 1);
    ctx.fillStyle=OL;         ctx.fillRect(sx-2,sy-32+bob+hipBob,8,3);
    ctx.fillStyle=HATBAND[0]; ctx.fillRect(sx-2,sy-32+bob+hipBob,8,2);
    ctx.fillStyle=HATBAND[1]; ctx.fillRect(sx-2,sy-32+bob+hipBob,5,1);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-6,sy-30+bob+hipBob,4,1);

    // ── Tool — extended to the right ──
    const toolR = TOOLS[player.tool]||TOOLS.till;
    p(sx+8,  sy-10+bob+hipBob, 12,3, toolR);
    p(sx+18, sy-14+bob+hipBob,  3,10, toolR);

  // ════════════════════════════════════════════════════════
  //  FACING LEFT  (left-facing side profile)
  //  Mirror of right: all X offsets negated.
  // ════════════════════════════════════════════════════════
  } else { // f === 'left'
    // Side-walk X offsets — legs swing forward(-) and back(+) along direction of travel
    const nearLegX = (wf===1 ? -5 : wf===3 ?  5 : 0); // near leg forward = negative X
    const farLegX  = -nearLegX;
    const nearArmX = -nearLegX;
    const farArmX  =  nearLegX;
    const hipBob   = (wf===0||wf===2) ? -1 : 0;

    // ── Far leg — behind body, drawn first ──
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+farLegX-1, sy-5+bob+hipBob-1, 6,12);
    ctx.fillStyle=PANTS[0]; ctx.fillRect(sx-2+farLegX,   sy-5+bob+hipBob,   4,10);
    ctx.fillStyle=PANTS[1]; ctx.fillRect(sx-2+farLegX,   sy-5+bob+hipBob,   3, 9);
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+farLegX-1, sy+4+bob+hipBob-1, 6,7);
    ctx.fillStyle=BOOT[0]; ctx.fillRect(sx-2+farLegX,   sy+4+bob+hipBob,   4,6);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-2+farLegX,   sy+4+bob+hipBob,   3,5);
    // Far toe pointing left
    ctx.fillStyle=OL;     ctx.fillRect(sx-5+farLegX,   sy+9+bob+hipBob,   4,2);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-5+farLegX,   sy+9+bob+hipBob,   2,2);

    // ── Far arm — behind body ──
    ctx.fillStyle=SHIRT[0]; ctx.fillRect(sx-3+farArmX, sy-13+bob+hipBob, 4, 8);
    ctx.fillStyle=SKIN[0];  ctx.fillRect(sx-3+farArmX, sy -6+bob+hipBob, 3, 5);

    // ── Body — side profile ──
    p(sx-5, sy-14+bob+hipBob, 9,12, SHIRT);
    ctx.fillStyle=SUSP[0]; ctx.fillRect(sx-2,sy-14+bob+hipBob,2,12);
    ctx.fillStyle=SUSP[1]; ctx.fillRect(sx-2,sy-14+bob+hipBob,1,12);

    // ── Near leg — in front ──
    ctx.fillStyle=OL;     ctx.fillRect(sx-2+nearLegX-1, sy-5+bob+hipBob-1, 6,12);
    ctx.fillStyle=PANTS[0]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   4,10);
    ctx.fillStyle=PANTS[1]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   3, 9);
    ctx.fillStyle=PANTS[2]; ctx.fillRect(sx-2+nearLegX,   sy-5+bob+hipBob,   2, 1);
    ctx.fillStyle=OL;     ctx.fillRect(sx-4+nearLegX-1, sy+4+bob+hipBob-1, 7,8);
    ctx.fillStyle=BOOT[0]; ctx.fillRect(sx-4+nearLegX,   sy+4+bob+hipBob,   5,6);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-4+nearLegX,   sy+4+bob+hipBob,   4,5);
    ctx.fillStyle=BOOT[2]; ctx.fillRect(sx-4+nearLegX,   sy+4+bob+hipBob,   3,1);
    // Toe cap — extends further left
    ctx.fillStyle=OL;     ctx.fillRect(sx-6+nearLegX,   sy+8+bob+hipBob,   4,3);
    ctx.fillStyle=BOOT[1]; ctx.fillRect(sx-7+nearLegX,   sy+9+bob+hipBob,   2,2);

    // ── Near arm — in front ──
    p(sx-6+nearArmX, sy-13+bob+hipBob, 4,9, SHIRT);
    p(sx-6+nearArmX, sy -5+bob+hipBob, 4,5, SKIN);

    // ── Neck ──
    p(sx-3, sy-18+bob+hipBob, 4,5, SKIN);

    // ── Head — left profile ──
    p(sx-6, sy-28+bob+hipBob, 9,11, SKIN);
    // Eye
    ctx.fillStyle=OL;       ctx.fillRect(sx-5,sy-25+bob+hipBob,3,3);
    ctx.fillStyle='#284838'; ctx.fillRect(sx-5,sy-25+bob+hipBob,2,2);
    ctx.fillStyle=OL;       ctx.fillRect(sx-5,sy-25+bob+hipBob,1,1);
    ctx.fillStyle='#f8f8f8'; ctx.fillRect(sx-5,sy-26+bob+hipBob,1,1);
    // Brow
    ctx.fillStyle=HAIR[0]; ctx.fillRect(sx-6,sy-27+bob+hipBob,4,1);
    // Nose protrudes left
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx-8,sy-24+bob+hipBob,3,2);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx-8,sy-23+bob+hipBob,2,1);
    // Mouth
    ctx.fillStyle=OL;     ctx.fillRect(sx-6,sy-20+bob+hipBob,2,1);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx-6,sy-20+bob+hipBob,1,1);
    // Ear
    ctx.fillStyle=SKIN[0]; ctx.fillRect(sx+1,sy-25+bob+hipBob,2,3);
    ctx.fillStyle=SKIN[1]; ctx.fillRect(sx+2,sy-24+bob+hipBob,1,2);
    // Hair at back of head
    ctx.fillStyle=HAIR[1]; ctx.fillRect(sx,sy-27+bob+hipBob,3,7);

    // ── Hat — brim extends prominently left ──
    ctx.fillStyle=OL;     ctx.fillRect(sx-15,sy-31+bob+hipBob,22,4);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-14,sy-31+bob+hipBob,20,3);
    ctx.fillStyle=HAT[1]; ctx.fillRect(sx-13,sy-31+bob+hipBob,18,2);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-13,sy-31+bob+hipBob,18,1);
    ctx.fillStyle=OL;     ctx.fillRect(sx-7,sy-40+bob+hipBob,10,10);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx-6,sy-39+bob+hipBob, 8, 9);
    ctx.fillStyle=HAT[1]; ctx.fillRect(sx-5,sy-39+bob+hipBob, 6, 8);
    ctx.fillStyle=HAT[2]; ctx.fillRect(sx-5,sy-39+bob+hipBob, 5, 1);
    ctx.fillStyle=OL;         ctx.fillRect(sx-6,sy-32+bob+hipBob,8,3);
    ctx.fillStyle=HATBAND[0]; ctx.fillRect(sx-6,sy-32+bob+hipBob,8,2);
    ctx.fillStyle=HATBAND[1]; ctx.fillRect(sx-6,sy-32+bob+hipBob,5,1);
    ctx.fillStyle=HAT[0]; ctx.fillRect(sx+2,sy-30+bob+hipBob,4,1);

    // ── Tool — extended to the left ──
    const toolL = TOOLS[player.tool]||TOOLS.till;
    p(sx-20, sy-10+bob+hipBob, 12,3, toolL);
    p(sx-20, sy-14+bob+hipBob,  3,10, toolL);

  } // end direction branches

  // ── Tool icon (all directions) ──
  const ti = {
    till:'⛏', water:'💧',
    plant:(CROPS[player.selectedSeed]&&CROPS[player.selectedSeed].icon)||'🌱',
    harvest:'🌾'
  };
  ctx.font='13px serif'; ctx.textAlign='center';
  ctx.fillText(ti[player.tool]||'', sx, sy-44+bob);

  if (inventory.totalWeight > getEffectiveWeightCap()*.8) {
    ctx.fillStyle='rgba(220,80,30,.9)'; ctx.font='7px sans-serif';
    ctx.fillText('⚠ HEAVY', sx, sy-52+bob);
  }
}