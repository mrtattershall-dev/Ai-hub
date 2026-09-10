function drawEnemies(cx, cy) {
  for (const e of enemies) {
    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx < -T*2 || sx > canvas.width+T*2 || sy < -T*2 || sy > canvas.height+T*2) continue;

    if (e.hidden) {
      // Burrower underground — draw subtle ground ripple
      ctx.globalAlpha = 0.3 + Math.sin(Date.now()*0.004)*0.1;
      ctx.fillStyle = '#604030';
      ctx.beginPath(); ctx.ellipse(sx, sy+4, 10, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    const eFlash = e.flashTimer > 0;
    ctx.globalAlpha = eFlash ? 0.55 : 1;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy+8, 8, 4, 0, 0, Math.PI*2); ctx.fill();

    // Walk frame helpers — same 4-frame stride as player
    const wf  = e.walkFrame;          // 0-3
    const fR  = e.facing !== 'left';  // true = facing right (or default)
    const dir = fR ? 1 : -1;          // +1 right, -1 left
    // Leg offsets for bipeds (side-walk X stride)
    const nLX = (wf===1 ?  5*dir : wf===3 ? -5*dir : 0); // near leg forward
    const fLX = -nLX;                                      // far leg behind
    const nAX = -nLX;                                      // near arm swings back
    const fAX =  nLX;                                      // far arm forward
    // Vertical bob shared with front/back views
    const bob = Math.round(Math.sin(wf * Math.PI/2) * 1.5);

    // ────────────────────────────────────────────────────
    //  BANDIT — bipedal, side-profile stride, knife in hand
    // ────────────────────────────────────────────────────
    if (e.type === 'bandit') {
      const C = eFlash ? '#fff' : null;
      const vest   = C || '#503828';
      const skin   = C || '#d4a060';
      const bndna  = C || '#c03020';
      const hatC   = C || '#302010';
      const knifeC = C || '#c0c0c0';
      const pantsC = C || '#282010';
      const bootC  = C || '#181008';

      // Far leg
      ctx.fillStyle=pantsC; ctx.fillRect(sx-2+fLX, sy+5+bob, 4,9);
      ctx.fillStyle=bootC;  ctx.fillRect(sx-2+fLX, sy+13+bob, 4,4);
      // Far arm (behind body)
      ctx.fillStyle=vest;   ctx.fillRect(sx-3+fAX, sy-10+bob, 3,8);
      ctx.fillStyle=skin;   ctx.fillRect(sx-3+fAX, sy-3+bob,  3,4);
      // Body — vest, side-on slightly narrower
      ctx.fillStyle=vest;   ctx.fillRect(sx-5, sy-10+bob, 10,16);
      ctx.fillStyle='rgba(0,0,0,.15)'; ctx.fillRect(sx-5, sy-10+bob, 10,2); // shoulder line
      // Near leg (front)
      ctx.fillStyle=pantsC; ctx.fillRect(sx-2+nLX, sy+5+bob, 5,9);
      ctx.fillStyle=bootC;  ctx.fillRect(sx-2+nLX, sy+13+bob, 5,4);
      ctx.fillStyle=eFlash?'#fff':'#2a1808'; // toe
      ctx.fillRect(sx+2+nLX*1+(fR?1:-2), sy+16+bob, 3,2);
      // Near arm — knife arm, raised on attack frames
      const armRaise = (e.attackTimer > 0.8) ? -4 : 0; // arm lifts when attacking
      ctx.fillStyle=vest;   ctx.fillRect(sx+2+nAX, sy-12+bob+armRaise, 4,9);
      ctx.fillStyle=skin;   ctx.fillRect(sx+2+nAX, sy-4+bob+armRaise,  4,4);
      // Knife — glints in near hand
      ctx.fillStyle=knifeC; ctx.fillRect(sx+5*dir+nAX, sy-8+bob+armRaise, 2,10);
      ctx.fillStyle='rgba(200,220,255,.6)'; ctx.fillRect(sx+5*dir+nAX, sy-8+bob+armRaise, 1,3);
      // Head
      ctx.fillStyle=skin;   ctx.fillRect(sx-4, sy-20+bob, 8,9);
      // Bandana covers lower face
      ctx.fillStyle=bndna;  ctx.fillRect(sx-4, sy-16+bob, 8,4);
      // Eyes — narrowed, dangerous
      ctx.fillStyle='#181010'; ctx.fillRect(sx+1*dir, sy-20+bob, 2,2);
      ctx.fillStyle='#e02020'; ctx.fillRect(sx+1*dir+1, sy-20+bob, 1,1);
      // Hat
      ctx.fillStyle=hatC;   ctx.fillRect(sx-6, sy-23+bob, 12,3); // brim
      ctx.fillStyle=hatC;   ctx.fillRect(sx-3, sy-29+bob, 8,7);  // crown
      ctx.fillStyle='#1a0c04'; ctx.fillRect(sx-3, sy-24+bob, 8,2); // hat band

    // ────────────────────────────────────────────────────
    //  WOLF — quadruped gallop cycle
    //  4-frame: 0=extend 1=gather 2=extend 3=gather (opposite legs)
    // ────────────────────────────────────────────────────
    } else if (e.type === 'wolf') {
      // Gallop uses pairs: front legs and back legs alternate thrust/recovery
      // f0: front extended+, back extended-  (full stretch)
      // f1: all legs under body              (gathered / airborne)
      // f2: front extended-, back extended+  (opposite stretch)
      // f3: all legs under body              (gathered)
      const gait = [
        { fFwd:7, fBwd:3, bFwd:-6, bBwd:-1, bodyY:0  },  // frame 0 stretch
        { fFwd:2, fBwd:0, bFwd: 0, bBwd: 0, bodyY:-2 },  // frame 1 gather (airborne bob)
        { fFwd:-5,fBwd:7, bFwd: 5, bBwd:-6, bodyY:0  },  // frame 2 opposite stretch
        { fFwd:0, fBwd:2, bFwd: 0, bBwd: 0, bodyY:-2 },  // frame 3 gather
      ][wf];
      const by = gait.bodyY + bob;
      const sign = fR ? 1 : -1;
      // Tail — curves based on frame
      const tailSwing = (wf===0||wf===2) ? -6 : 0;
      ctx.strokeStyle=eFlash?'#fff':'#707080'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(sx-8*sign, sy+by);
      ctx.quadraticCurveTo(sx-14*sign, sy-2+tailSwing, sx-12*sign, sy-8+tailSwing);
      ctx.stroke();
      // Back legs
      ctx.fillStyle=eFlash?'#fff':'#505060';
      ctx.fillRect(sx-4+gait.bBwd*sign, sy+5+by, 3,7);
      ctx.fillRect(sx-1+gait.bFwd*sign, sy+5+by, 3,7);
      // Body — low, elongated
      ctx.fillStyle=eFlash?'#fff':'#707080';
      ctx.beginPath(); ctx.ellipse(sx, sy+2+by, 10, 6, 0, 0, Math.PI*2); ctx.fill();
      // Back stripe
      ctx.fillStyle=eFlash?'#fff':'#404050';
      ctx.fillRect(sx-6, sy-1+by, 12,3);
      // Front legs
      ctx.fillStyle=eFlash?'#fff':'#606070';
      ctx.fillRect(sx+2*sign+gait.fBwd*sign, sy+4+by, 3,7);
      ctx.fillRect(sx+5*sign+gait.fFwd*sign, sy+4+by, 3,7);
      // Head — pushed in direction of travel, bobs on gallop
      ctx.fillStyle=eFlash?'#fff':'#808090';
      ctx.beginPath(); ctx.ellipse(sx+10*sign, sy-2+by, 7,6, 0.3*sign, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle=eFlash?'#fff':'#606070';
      ctx.beginPath(); ctx.ellipse(sx+16*sign, sy+by, 4,3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#181818';
      ctx.beginPath(); ctx.arc(sx+19*sign, sy-1+by, 1.2, 0, Math.PI*2); ctx.fill();
      // Eyes — glow yellow at night
      ctx.fillStyle = gameState.isNight ? '#d0e020' : '#d0c080';
      ctx.beginPath(); ctx.arc(sx+12*sign, sy-4+by, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(sx+12*sign, sy-4+by, 1, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle=eFlash?'#fff':'#606070';
      ctx.beginPath(); ctx.moveTo(sx+9*sign,sy-7+by); ctx.lineTo(sx+7*sign,sy-14+by); ctx.lineTo(sx+13*sign,sy-9+by); ctx.fill();

    // ────────────────────────────────────────────────────
    //  BURROWER — scuttling insect, legs ripple in wave
    // ────────────────────────────────────────────────────
    } else if (e.type === 'burrower') {
      // 3 pairs of legs ripple in a wave — offset by leg index
      ctx.strokeStyle=eFlash?'#fff':'#604828'; ctx.lineWidth=1.5;
      const legPairs = [[-7,-3],[-8,0],[-7,3]]; // [baseX offsets, baseY]
      for (let li=0; li<3; li++) {
        const [lbx, lby] = legPairs[li];
        // Phase offset per leg pair — creates wave
        const phase = (wf + li) % 4;
        const liftY = (phase===1||phase===3) ? -4 : 0;
        const spreadX = (phase===0||phase===2) ? 7 : 5;
        // Left leg
        ctx.beginPath(); ctx.moveTo(sx+lbx, sy+lby+bob);
        ctx.lineTo(sx+lbx-spreadX, sy+lby-3+liftY+bob); ctx.stroke();
        // Right leg
        ctx.beginPath(); ctx.moveTo(sx-lbx, sy+lby+bob);
        ctx.lineTo(sx-lbx+spreadX, sy+lby-3+liftY+bob); ctx.stroke();
      }
      // Segmented body — 3 segments, bob with walk
      ctx.fillStyle=eFlash?'#fff':'#604828';
      ctx.beginPath(); ctx.ellipse(sx, sy+3+bob, 7,5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=eFlash?'#fff':'#806040';
      ctx.beginPath(); ctx.ellipse(sx, sy-2+bob, 6,4, 0, 0, Math.PI*2); ctx.fill();
      // Segment joint lines
      ctx.strokeStyle=eFlash?'#fff':'rgba(40,20,8,.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.ellipse(sx, sy+1+bob, 5,2, 0, 0, Math.PI*2); ctx.stroke();
      // Head
      ctx.fillStyle=eFlash?'#fff':'#503818';
      ctx.beginPath(); ctx.ellipse(sx, sy-8+bob, 5,4, 0, 0, Math.PI*2); ctx.fill();
      // Mandibles — snap open on attack frames
      const mandSnap = e.attackTimer > 0.5 ? 3 : 0;
      ctx.fillStyle=eFlash?'#fff':'#c08030';
      ctx.beginPath(); ctx.moveTo(sx-5,sy-9+bob); ctx.lineTo(sx-9-mandSnap,sy-14+bob); ctx.lineTo(sx-3,sy-10+bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx+5,sy-9+bob); ctx.lineTo(sx+9+mandSnap,sy-14+bob); ctx.lineTo(sx+3,sy-10+bob); ctx.fill();
      // Antennae
      ctx.strokeStyle=eFlash?'#fff':'#a07030'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(sx-2,sy-12+bob); ctx.lineTo(sx-6,sy-18+bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx+2,sy-12+bob); ctx.lineTo(sx+6,sy-18+bob); ctx.stroke();
      // Red eyes — glow
      ctx.fillStyle=eFlash?'#fff':'#e02020';
      ctx.beginPath(); ctx.arc(sx-2,sy-9+bob,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+2,sy-9+bob,1.8,0,Math.PI*2); ctx.fill();

    // ────────────────────────────────────────────────────
    //  RAIDER — heavily armoured, lumbering stride, axe raised
    // ────────────────────────────────────────────────────
    } else if (e.type === 'raider') {
      const armorC  = eFlash?'#fff':'#606870';
      const bodyC   = eFlash?'#fff':'#401818';
      const helmC   = eFlash?'#fff':'#505860';
      const skinC   = eFlash?'#fff':'#c09060';
      const axeC    = eFlash?'#fff':'#b0b0b0';
      const bootC   = eFlash?'#fff':'#2a1808';
      // Raider is heavy — smaller stride, +1 scale
      const rNLX = (wf===1 ? 4*dir : wf===3 ? -4*dir : 0);
      const rFLX = -rNLX;
      const rBob = Math.round(Math.sin(wf*Math.PI/2)*1);

      // Far leg
      ctx.fillStyle=bodyC; ctx.fillRect(sx-3+rFLX, sy+6+rBob, 6,10);
      ctx.fillStyle=bootC; ctx.fillRect(sx-4+rFLX, sy+14+rBob, 7,5);
      // Far arm
      ctx.fillStyle=armorC; ctx.fillRect(sx-4+rFLX*1, sy-11+rBob, 5,10);
      ctx.fillStyle=skinC;  ctx.fillRect(sx-4+rFLX*1, sy-2+rBob,  5,4);
      // Body — armour plate
      ctx.fillStyle=bodyC;  ctx.fillRect(sx-9, sy-13+rBob, 18,20);
      ctx.fillStyle=armorC; ctx.fillRect(sx-8, sy-11+rBob, 16,12);
      // Armour rivets
      ctx.fillStyle='rgba(255,255,255,.12)';
      ctx.fillRect(sx-6,sy-10+rBob,2,2); ctx.fillRect(sx+4,sy-10+rBob,2,2);
      ctx.fillRect(sx-6,sy-4+rBob, 2,2); ctx.fillRect(sx+4,sy-4+rBob, 2,2);
      // Near leg
      ctx.fillStyle=bodyC; ctx.fillRect(sx-2+rNLX, sy+6+rBob, 7,10);
      ctx.fillStyle=bootC; ctx.fillRect(sx-3+rNLX, sy+14+rBob, 8,5);
      ctx.fillStyle=eFlash?'#fff':'#1a1008';
      ctx.fillRect(sx+3*dir+rNLX, sy+18+rBob, 4,2); // toe
      // Near arm — axe arm, swing on walk
      const axeSwing = (wf===1||wf===3) ? -3*dir : 0;
      ctx.fillStyle=armorC; ctx.fillRect(sx+4*dir, sy-14+rBob+axeSwing, 5,11);
      ctx.fillStyle=skinC;  ctx.fillRect(sx+4*dir, sy-4+rBob+axeSwing,  5,4);
      // Axe — handle + head
      ctx.fillStyle=eFlash?'#fff':'#6a4818'; // handle wood
      ctx.fillRect(sx+8*dir, sy-16+rBob+axeSwing, 3*dir, 16);
      ctx.fillStyle=axeC; // blade
      ctx.fillRect(sx+8*dir, sy-18+rBob+axeSwing, 7*dir, 7);
      ctx.fillStyle='rgba(200,220,255,.5)'; // glint
      ctx.fillRect(sx+8*dir, sy-18+rBob+axeSwing, 1*dir, 3);
      // Helmet
      ctx.fillStyle=helmC; ctx.fillRect(sx-7, sy-24+rBob, 14,6);  // helm top
      ctx.fillRect(sx-7, sy-19+rBob, 14,4); // visor
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(sx-5, sy-19+rBob, 10,2); // eye slit
      // Neck/face stub below visor
      ctx.fillStyle=skinC; ctx.fillRect(sx-4, sy-15+rBob, 8,3);

    // ────────────────────────────────────────────────────
    //  SNAKE — sinuous S-curve slither, direction-aware
    // ────────────────────────────────────────────────────
    } else if (e.type === 'snake') {
      // Slither: the S-curve phase advances with walkFrame
      // The whole body shifts in the direction of travel
      const t2 = Date.now()*0.006 + e.id;
      const wob1 =  Math.sin(t2) * 4;
      const wob2 = -Math.sin(t2) * 4;
      const bodyCol  = eFlash?'#fff':'#508038';
      const bellyCol = eFlash?'#fff':'#90b860';
      // Draw thick body path (double pass — belly lighter underneath)
      for (let pass=0; pass<2; pass++) {
        ctx.strokeStyle = pass===0 ? bodyCol : bellyCol;
        ctx.lineWidth   = pass===0 ? 7 : 4;
        ctx.beginPath();
        if (fR) {
          ctx.moveTo(sx-14, sy+4);
          ctx.quadraticCurveTo(sx-4, sy-5+wob1, sx+4,  sy+4);
          ctx.quadraticCurveTo(sx+10,sy+10+wob2, sx+16, sy+1);
        } else {
          ctx.moveTo(sx+14, sy+4);
          ctx.quadraticCurveTo(sx+4, sy-5+wob1, sx-4,  sy+4);
          ctx.quadraticCurveTo(sx-10,sy+10+wob2, sx-16, sy+1);
        }
        ctx.stroke();
      }
      // Scale pattern dots along body
      ctx.fillStyle='rgba(30,50,20,.4)';
      const dotOff = fR ? 1 : -1;
      for (let i=0; i<4; i++) {
        ctx.beginPath(); ctx.arc(sx + (i-2)*5*dotOff, sy + Math.sin(t2+i)*2, 1.5, 0, Math.PI*2); ctx.fill();
      }
      // Head at the forward end
      const hx = fR ? sx+16 : sx-16;
      ctx.fillStyle=eFlash?'#fff':'#406830';
      ctx.beginPath(); ctx.ellipse(hx, sy+1, 6,4, fR?0.4:-0.4, 0, Math.PI*2); ctx.fill();
      // Forked tongue flick — flicks in and out
      const tongueOut = Math.sin(t2*3) > 0.5;
      if (tongueOut) {
        ctx.strokeStyle='#e03030'; ctx.lineWidth=1.5;
        const tx2 = hx + 6*dir, ty2 = sy+1;
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(tx2+4*dir, ty2-2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(tx2+4*dir, ty2+2); ctx.stroke();
      }
      // Eye
      ctx.fillStyle='#d0e020';
      ctx.beginPath(); ctx.arc(hx-2*dir, sy-1, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.arc(hx-2*dir, sy-1, 0.8, 0, Math.PI*2); ctx.fill();
      // Rattle tail (small segments at tail end)
      ctx.fillStyle=eFlash?'#fff':'#c0a030';
      const tailX = fR ? sx-14 : sx+14;
      ctx.beginPath(); ctx.ellipse(tailX, sy+4, 3,2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=eFlash?'#fff':'#d0b040';
      ctx.beginPath(); ctx.ellipse(tailX - 3*dir, sy+4, 2,1.5, 0, 0, Math.PI*2); ctx.fill();

    } else if (e.type === 'pirateSkiff') {
      // Pirate skiff — a low wooden vessel with a black sail, approaches from the east
      // Rendered as a side-profile boat sprite. Faces left (toward dock) always.
      const bt = Date.now() * 0.0008;
      const skiffBob = Math.sin(bt + e.id) * 2.5;
      const C = eFlash ? '#fff' : null;
      const hullC  = C || '#3a2218';
      const deckC  = C || '#523020';
      const sailC  = C || '#1a1a1a';
      const mastC  = C || '#2a1808';
      const waterC = 'rgba(20,90,130,0.55)';
      const wakeC  = 'rgba(120,200,230,0.35)';

      // Water wake behind (to the right — ship moves left)
      ctx.fillStyle = wakeC;
      ctx.beginPath();
      ctx.ellipse(sx + 28, sy + 6 + skiffBob, 18, 5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + 42, sy + 8 + skiffBob, 10, 3, 0.2, 0, Math.PI*2);
      ctx.fill();

      // Hull — wide, low, side-on
      ctx.fillStyle = C || '#1a0e06';
      ctx.fillRect(sx - 26, sy + 2 + skiffBob, 52, 14);  // outline
      ctx.fillStyle = hullC;
      ctx.fillRect(sx - 25, sy + 3 + skiffBob, 50, 12);
      // Hull curve bow (left, toward dock)
      ctx.fillStyle = C || '#1a0e06';
      ctx.fillRect(sx - 28, sy + 6 + skiffBob, 4, 8);
      ctx.fillStyle = hullC;
      ctx.fillRect(sx - 27, sy + 7 + skiffBob, 3, 6);
      // Stern square (right)
      ctx.fillStyle = deckC;
      ctx.fillRect(sx + 22, sy + 3 + skiffBob, 4, 6);

      // Deck line
      ctx.fillStyle = deckC;
      ctx.fillRect(sx - 22, sy + 3 + skiffBob, 44, 4);
      // Plank lines on deck
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let pi = 0; pi < 4; pi++) {
        ctx.fillRect(sx - 22 + pi * 11, sy + 3 + skiffBob, 1, 4);
      }
      // Gunwale highlights
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(sx - 25, sy + 3 + skiffBob, 50, 1);

      // Mast
      ctx.fillStyle = mastC;
      ctx.fillRect(sx - 2, sy - 30 + skiffBob, 3, 34);
      ctx.fillStyle = C || '#3a2010';
      ctx.fillRect(sx - 1, sy - 30 + skiffBob, 2, 33);
      // Boom (horizontal spar)
      ctx.fillStyle = mastC;
      ctx.fillRect(sx - 18, sy - 10 + skiffBob, 20, 2);

      // Black sail — tattered, slightly billowed
      const billowL = Math.sin(bt * 1.1) * 3;
      const billowT = Math.sin(bt * 0.9 + 0.5) * 2;
      ctx.fillStyle = C || 'rgba(18,12,8,0.92)';
      ctx.beginPath();
      ctx.moveTo(sx - 1, sy - 29 + skiffBob);
      ctx.lineTo(sx - 1 - 18 + billowL, sy - 18 + skiffBob + billowT);
      ctx.lineTo(sx - 1 - 16 + billowL, sy - 8  + skiffBob);
      ctx.lineTo(sx - 1, sy - 10 + skiffBob);
      ctx.closePath();
      ctx.fill();
      // Skull on sail
      if (!eFlash) {
        ctx.fillStyle = 'rgba(200,180,140,0.7)';
        const skullX = sx - 10, skullY = sy - 22 + skiffBob;
        ctx.beginPath(); ctx.ellipse(skullX, skullY, 4, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(18,12,8,0.9)';
        ctx.fillRect(skullX - 3, skullY + 2, 2, 3); // left eye socket
        ctx.fillRect(skullX + 1, skullY + 2, 2, 3); // right eye socket
        // Crossbones
        ctx.strokeStyle = 'rgba(200,180,140,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(skullX - 4, skullY + 6); ctx.lineTo(skullX + 4, skullY + 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(skullX + 4, skullY + 6); ctx.lineTo(skullX - 4, skullY + 10); ctx.stroke();
      }

      // Tattered sail edge
      ctx.fillStyle = C || 'rgba(10,7,4,0.85)';
      for (let ti = 0; ti < 3; ti++) {
        ctx.fillRect(sx - 18 + ti * 5, sy - 12 + skiffBob, 2, 3 + ti);
      }

      // Crew — two silhouette heads on deck
      ctx.fillStyle = C || '#1a1008';
      ctx.beginPath(); ctx.ellipse(sx - 14, sy + 1 + skiffBob, 4, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 8, sy + 1 + skiffBob, 4, 4, 0, 0, Math.PI*2); ctx.fill();
      // Cutlass glint on one crew
      if (!eFlash && e.attackTimer > 0.5) {
        ctx.strokeStyle = 'rgba(200,210,220,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx - 14, sy - 2 + skiffBob); ctx.lineTo(sx - 22, sy - 9 + skiffBob); ctx.stroke();
      }

      // Water line (ripple)
      ctx.fillStyle = waterC;
      ctx.fillRect(sx - 27, sy + 13 + skiffBob, 54, 2);

      // Name tag
      if (!eFlash) {
        ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText('PIRATE SKIFF', sx + 1, sy - 38 + skiffBob);
        ctx.fillStyle = 'rgba(200,60,40,0.75)'; ctx.fillText('PIRATE SKIFF', sx, sy - 39 + skiffBob);
      }

    } else {
      // Generic fallback
      ctx.fillStyle=eFlash?'#fff':e.def.color;
      ctx.fillRect(sx-7, sy-10, 14,14);
      ctx.fillStyle=eFlash?'#fff':'#d4a870';
      ctx.fillRect(sx-5, sy-18, 10, 9);
    }

    ctx.globalAlpha = 1;

    // HP bar — only show when damaged
    const hpPct = e.hp / e.maxHp;
    if (hpPct < 1) {
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(sx-12, sy-30, 24,3);
      ctx.fillStyle = hpPct>0.5?'#60d040':hpPct>0.25?'#d0a020':'#d03020';
      ctx.fillRect(sx-12, sy-30, 24*hpPct, 3);
    }
  }
  ctx.globalAlpha = 1;
}