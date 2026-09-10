function drawCharacter(ctx, sx, sy, facing, wf, sprinting, cfg) {
  const isFem = (cfg.gender || 'male') === 'female';

  const SKIN  = CC_SKIN_TONES  [Math.min(cfg.skinTone  ||0, CC_SKIN_TONES.length-1)];
  const HAIR  = CC_HAIR_COLORS [Math.min(cfg.hairColor ||1, CC_HAIR_COLORS.length-1)];
  const SHIRT = CC_SHIRT_COLORS[Math.min(cfg.shirtColor||0, CC_SHIRT_COLORS.length-1)];
  const PANTS = CC_PANTS_COLORS[Math.min(cfg.pantsColor||0, CC_PANTS_COLORS.length-1)];
  const HAT   = CC_HAT_COLORS  [Math.min(cfg.hatColor  ||0, CC_HAT_COLORS.length-1)];
  const BOOT  = ['#221008','#3a1e0a','#5a3014'];
  const B     = '#100808';

  const hs = cfg.hairStyle  || 0;
  const ss = cfg.shirtStyle || 0;

  // walk frames: 0=idle,1=left-foot,2=idle,3=right-foot
  // Stardew-style: legs alternate, arms counter-swing
  const lLegO = (wf===1) ? -2 : (wf===3) ?  3 : 0;   // left leg Y offset
  const rLegO = (wf===1) ?  3 : (wf===3) ? -2 : 0;
  const lArmO = lLegO * 0.6 | 0;
  const rArmO = rLegO * 0.6 | 0;
  const bob   = (wf===1||wf===3) ? -1 : 0;             // body bob up on stride

  // pixel fill shorthand
  function p(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }

  // outlined rect with optional L/R shade (shade=[dark,light])
  function r(x,y,w,h,c,sh){
    p(x-1,y,1,h,B); p(x+w,y,1,h,B); p(x,y-1,w,1,B); p(x,y+h,w,1,B);
    p(x,y,w,h,c);
    if(sh){ p(x,y,1,h,sh[1]); p(x,y,w,1,sh[1]); p(x+w-1,y,1,h,sh[0]); p(x,y+h-1,w,1,sh[0]); }
  }

  // ─── FRONT (down) ────────────────────────────────────────────
  if(facing==='down'){
    const by = sy + bob;

    // boots  4×4
    r(sx-5, by-4+lLegO, 4,4, BOOT[1],[BOOT[2],BOOT[0]]);
    r(sx+1, by-4+rLegO, 4,4, BOOT[1],[BOOT[2],BOOT[0]]);
    // toe rounding
    p(sx-6,by-1+lLegO,1,2,B); p(sx+5,by-1+rLegO,1,2,B);

    // legs  3×7  (hidden under prairie dress)
    if(!(isFem && ss===1)){
      r(sx-5, by-11+lLegO, 3,7, PANTS[1],[PANTS[2],PANTS[0]]);
      r(sx+2, by-11+rLegO, 3,7, PANTS[1],[PANTS[2],PANTS[0]]);
    }

    // female prairie dress — wide A-line skirt (ss===1)
    if(isFem && ss===1){
      const sk0=shadeColor(SHIRT[0],-18), sk1=SHIRT[1], sk2=SHIRT[2];
      // Flare from hip (9px wide) to hem (18px wide), 12 rows
      p(sx-4,by-12+bob,  9,1, sk2);      // hip seam highlight
      p(sx-5,by-11+bob, 11,2, sk1);      // band 1
      p(sx-6,by-9+bob,  13,2, sk0);      // band 2
      p(sx-7,by-7+bob,  15,2, sk1);      // band 3
      p(sx-8,by-5+bob,  17,2, sk0);      // band 4
      p(sx-8,by-3+bob,  17,2, sk1);      // hem band
      // Diagonal side outlines
      p(sx-4,by-13+bob,9,1,B);           // top edge
      p(sx-5,by-12+bob,1,2,B); p(sx-6,by-10+bob,1,2,B);
      p(sx-7,by-8+bob, 1,2,B); p(sx-9,by-6+bob, 1,7,B);
      p(sx+4,by-12+bob,1,2,B); p(sx+6,by-10+bob,1,2,B);
      p(sx+7,by-8+bob, 1,2,B); p(sx+8,by-6+bob, 1,7,B);
      p(sx-8,by-1+bob,17,1,B);           // hem bottom
    }

    // torso  8×9
    const tw=8, tx=sx-4;
    r(tx, by-20+bob, tw,9, SHIRT[1],[SHIRT[2],SHIRT[0]]);
    // shirt detail
    if(ss===0){      // suspenders
      p(tx+1,by-20+bob,2,8,shadeColor(SHIRT[0],-28));
      p(tx+5,by-20+bob,2,8,shadeColor(SHIRT[0],-28));
    } else if(ss===2){ // vest lapels
      p(tx+1,by-20+bob,2,7,shadeColor(SHIRT[0],-35));
      p(tx+5,by-20+bob,2,7,shadeColor(SHIRT[0],-35));
    } else if(ss===4){ // jacket collar
      p(sx-1,by-20+bob,3,3,shadeColor(SHIRT[0],-40));
      p(sx,  by-20+bob,1,2,shadeColor(SHIRT[1],+15));
    }
    if(isFem && ss===0){ // blouse bow
      p(sx-1,by-19+bob,3,2,shadeColor(SHIRT[2],+18));
      p(sx,  by-19+bob,1,1,B);
    }
    if(isFem && ss===1){ // prairie dress bodice — narrow waist, wide collar
      // Narrow the waist (lower torso) by 1px each side
      p(tx-1,by-14+bob,1,3,B);  p(tx+tw,by-14+bob,1,3,B);  // side nip
      p(tx,  by-14+bob,1,3,shadeColor(SHIRT[0],-20));         // waist shadow L
      p(tx+tw-1,by-14+bob,1,3,shadeColor(SHIRT[0],-20));      // waist shadow R
      // Collar / yoke detail
      p(sx-2,by-19+bob,5,1,shadeColor(SHIRT[2],+22));
      p(sx-1,by-20+bob,3,1,shadeColor(SHIRT[2],+28));
    }

    // arms  2×8 (upper sleeve + forearm)
    // left arm
    p(tx-2,by-20+bob+lArmO, 1,1,B);
    r(tx-2,by-19+bob+lArmO, 2,4, SHIRT[1],[SHIRT[2],SHIRT[0]]);  // sleeve
    r(tx-2,by-15+bob+lArmO, 2,4, SKIN[1],[SKIN[2],SKIN[0]]);     // forearm
    if(ss===3) p(tx-2,by-15+bob+lArmO,2,2,shadeColor(SHIRT[0],-5)); // cuff
    // right arm
    p(tx+tw+1,by-20+bob+rArmO, 1,1,B);
    r(tx+tw,  by-19+bob+rArmO, 2,4, SHIRT[1],[SHIRT[2],SHIRT[0]]);
    r(tx+tw,  by-15+bob+rArmO, 2,4, SKIN[1],[SKIN[2],SKIN[0]]);
    if(ss===3) p(tx+tw,by-15+bob+rArmO,2,2,shadeColor(SHIRT[0],-5));

    // neck  3×2
    p(sx-2,by-21+bob,4,1,B);
    r(sx-1,by-21+bob, 3,2, SKIN[1],[SKIN[2],SKIN[0]]);

    // head  10×11  (rounded — clip corners)
    const hx=sx-5, hy=by-32+bob;
    // outline cross-pattern for rounded feel
    p(hx+1,hy,   8,13,B);    // vertical bar of outline
    p(hx,  hy+1,10,11,B);    // horizontal bar
    p(hx+1,hy+1, 8,11,SKIN[1]);  // fill
    // shading
    p(hx+1,hy+1, 1,11,SKIN[2]);
    p(hx+1,hy+1, 8, 1,SKIN[2]);
    p(hx+8,hy+1, 1,11,SKIN[0]);
    p(hx+1,hy+11,8, 1,SKIN[0]);
    // cheeks
    ctx.globalAlpha=0.38;
    p(hx+1,hy+7,2,2,isFem?'#e87878':'#c86060');
    p(hx+7,hy+7,2,2,isFem?'#e87878':'#c86060');
    ctx.globalAlpha=1;
    // eyes  — 2×3 with iris + catchlight
    const ec='#1c3460';
    p(hx+2,hy+3, 2,4,B);          // left eye socket
    p(hx+2,hy+3, 2,3,ec);         // iris
    p(hx+2,hy+3, 1,1,'#d0e4ff');  // catchlight
    p(hx+6,hy+3, 2,4,B);
    p(hx+6,hy+3, 2,3,ec);
    p(hx+6,hy+3, 1,1,'#d0e4ff');
    if(isFem){
      p(hx+1,hy+2,4,1,B);  p(hx+5,hy+2,4,1,B);   // lashes
    }
    // brows
    p(hx+2,hy+1,3,1,HAIR[0]);
    p(hx+6,hy+1,2,1,HAIR[0]);
    // nose
    p(sx-1,hy+7,2,1,shadeColor(SKIN[0],-12));
    // mouth
    p(sx-1,hy+9,4,1,B);
    p(sx,  hy+9,1,1,SKIN[1]); p(sx+2,hy+9,1,1,SKIN[1]);
    if(isFem){ p(sx,hy+9,2,1,'#bf5560'); }

    if(HAT){ ctx.save(); ctx.beginPath(); ctx.rect(hx-15, hy, 40, 71); ctx.clip(); }
    _drawHair(ctx,hx,hy,10,11,hs,isFem,HAIR,B,'down');
    if(HAT){ ctx.restore(); }
    // Hat/hair fix: draw hat after clipped hair so crown is clean
    _drawHat(ctx,sx,by+bob,HAT,B,'down');
  }

  // ─── BACK (up) ───────────────────────────────────────────────
  else if(facing==='up'){
    const by=sy+bob;

    r(sx-5,by-4+lLegO,4,4,BOOT[1],[BOOT[2],BOOT[0]]);
    r(sx+1,by-4+rLegO,4,4,BOOT[1],[BOOT[2],BOOT[0]]);
    if(!(isFem && ss===1)){
      r(sx-5,by-11+lLegO,3,7,PANTS[1],[PANTS[2],PANTS[0]]);
      r(sx+2,by-11+rLegO,3,7,PANTS[1],[PANTS[2],PANTS[0]]);
    }

    const tw=8,tx=sx-4;
    r(tx,by-20+bob,tw,9,shadeColor(SHIRT[1],-20),[SHIRT[1],shadeColor(SHIRT[0],-28)]);
    if(ss===0){
      p(tx+1,by-20+bob,2,8,shadeColor(SHIRT[0],-28));
      p(tx+5,by-20+bob,2,8,shadeColor(SHIRT[0],-28));
    }
    // female prairie dress back skirt
    if(isFem && ss===1){
      const sk0=shadeColor(SHIRT[0],-30), sk1=shadeColor(SHIRT[1],-20), sk2=shadeColor(SHIRT[2],-10);
      p(sx-4,by-12+bob,  9,1, sk2);
      p(sx-5,by-11+bob, 11,2, sk1);
      p(sx-6,by-9+bob,  13,2, sk0);
      p(sx-7,by-7+bob,  15,2, sk1);
      p(sx-8,by-5+bob,  17,2, sk0);
      p(sx-8,by-3+bob,  17,2, sk1);
      p(sx-4,by-13+bob,9,1,B);
      p(sx-5,by-12+bob,1,2,B); p(sx-6,by-10+bob,1,2,B);
      p(sx-7,by-8+bob, 1,2,B); p(sx-9,by-6+bob, 1,7,B);
      p(sx+4,by-12+bob,1,2,B); p(sx+6,by-10+bob,1,2,B);
      p(sx+7,by-8+bob, 1,2,B); p(sx+8,by-6+bob, 1,7,B);
      p(sx-8,by-1+bob,17,1,B);
    }
    p(tx-2,by-19+bob+lArmO,1,1,B); r(tx-2,by-19+bob+lArmO,2,4,SHIRT[1],[SHIRT[2],SHIRT[0]]);
    r(tx-2,by-15+bob+lArmO,2,4,SKIN[1],[SKIN[2],SKIN[0]]);
    p(tx+tw+1,by-19+bob+rArmO,1,1,B); r(tx+tw,by-19+bob+rArmO,2,4,SHIRT[1],[SHIRT[2],SHIRT[0]]);
    r(tx+tw,by-15+bob+rArmO,2,4,SKIN[1],[SKIN[2],SKIN[0]]);

    r(sx-1,by-21+bob,3,2,SKIN[0],[SKIN[1],shadeColor(SKIN[0],-15)]);

    const hx=sx-5,hy=by-32+bob;
    p(hx+1,hy,8,13,B); p(hx,hy+1,10,11,B);
    p(hx+1,hy+1,8,11,SKIN[1]);
    p(hx+1,hy+1,1,11,SKIN[2]); p(hx+8,hy+1,1,11,SKIN[0]);

    if(HAT){ ctx.save(); ctx.beginPath(); ctx.rect(hx-15, hy, 40, 71); ctx.clip(); }
    _drawHair(ctx,hx,hy,10,11,hs,isFem,HAIR,B,'up');
    if(HAT){ ctx.restore(); }
    _drawHat(ctx,sx,by+bob,HAT,B,'up');
  }

  // ─── RIGHT ───────────────────────────────────────────────────
  else if(facing==='right'){
    const by=sy+bob;
    // Side stride: near leg swings forward(+X)/back(-X), far leg opposite
    // wf1 = near fwd, wf3 = near back, 0/2 = idle
    const nX = (wf===1) ?  3 : (wf===3) ? -3 : 0;  // near leg X offset
    const fX = -nX;                                   // far leg X offset
    const aX = -nX;                                   // near arm counter-swings

    // far leg (behind, darker) — shifts back when near strides fwd
    if(!(isFem && ss===1)){
      p(sx-2+fX, by-11, 2,11, B);
      p(sx-2+fX, by-11, 2, 7, PANTS[0]);
      p(sx-2+fX, by- 4, 2, 4, BOOT[0]);
    }

    // far arm (behind torso, dark strip)
    p(sx-2-aX, by-20+bob, 2,10, B);
    p(sx-2-aX, by-20+bob, 2, 5, shadeColor(SHIRT[0],-35));
    p(sx-2-aX, by-15+bob, 2, 5, shadeColor(SKIN[0],-20));

    // torso side — tapered: wider at shoulders, narrower at waist
    // Shoulders (top): 8px wide  sx-3 to sx+4
    // Waist (bottom):  6px wide  sx-2 to sx+3
    p(sx-4,by-20+bob, 1,1,B); p(sx+4,by-20+bob,1,1,B); // shoulder corners
    p(sx-3,by-20+bob, 8,1, SHIRT[2]);    // shoulder highlight row
    p(sx-3,by-19+bob, 8,3, SHIRT[1]);    // upper torso
    p(sx-3,by-16+bob, 1,1, SHIRT[2]); p(sx+4,by-16+bob,1,1,SHIRT[0]); // taper pixel
    p(sx-2,by-16+bob, 6,4, SHIRT[1]);    // mid torso
    p(sx-2,by-12+bob, 6,1, SHIRT[0]);    // waist shadow
    // outline
    p(sx-4,by-20+bob, 1,9, B); p(sx+4,by-20+bob,1,4,B); p(sx+3,by-16+bob,1,5,B);
    p(sx-3,by-21+bob, 8,1, B); p(sx-2,by-12+bob,6,1,B);

    // near leg — shifts forward
    if(!(isFem && ss===1)){
      p(sx-1+nX,by-12, 1,1, B);  // crotch corner
      p(sx-1+nX,by-11, 3,7, PANTS[1]);
      p(sx-1+nX,by-11, 1,7, PANTS[2]);  // front edge highlight
      p(sx+1+nX,by-11, 1,7, PANTS[0]);  // back edge shadow
      p(sx-2+nX,by-11, 1,8, B); p(sx+2+nX,by-11,1,8,B); // leg outline
      // near boot
      p(sx-2+nX,by-4,  5,4, BOOT[1]);
      p(sx-2+nX,by-4,  2,3, BOOT[2]);   // toe highlight
      p(sx+2+nX,by-4,  1,3, BOOT[0]);   // heel shadow
      p(sx-3+nX,by-4,  1,1, B); p(sx+3+nX,by-4,1,4,B); // boot outline
      p(sx-3+nX,by-5,  5,1, B); p(sx-3+nX,by,   5,1,B);
    }
    // female prairie dress — side view skirt (right)
    if(isFem && ss===1){
      const sk0=shadeColor(SHIRT[0],-18), sk1=SHIRT[1], sk2=SHIRT[2];
      // Wide trapezoid: narrow at hip, wide at hem, swings slightly forward
      p(sx-3,by-12+bob, 8,1, sk2);       // hip seam
      p(sx-4,by-11+bob,10,2, sk1);       // upper
      p(sx-5,by-9+bob, 12,2, sk0);       // mid-upper
      p(sx-5,by-7+bob, 13,2, sk1);       // mid
      p(sx-6,by-5+bob, 14,2, sk0);       // lower
      p(sx-6,by-3+bob, 14,2, sk1);       // hem
      // Outline
      p(sx-3,by-13+bob,8,1,B);           // top
      p(sx-4,by-12+bob,1,2,B); p(sx-5,by-10+bob,1,2,B); p(sx-7,by-8+bob,1,7,B); // back
      p(sx+4,by-12+bob,1,1,B); p(sx+5,by-11+bob,1,2,B); p(sx+7,by-9+bob,1,7,B); // front
      p(sx-6,by-1+bob,14,1,B);           // hem line
    }
    // prairie dress boots — peek out under hem
    if(isFem && ss===1){
      // far boot (darker, behind)
      p(sx-2+fX,by-4,2,4,BOOT[0]); p(sx-3+fX,by-4,1,4,B); p(sx+0+fX,by-4,1,4,B); p(sx-2+fX,by,2,1,B);
      // near boot
      p(sx-2+nX,by-4,5,4,BOOT[1]); p(sx-2+nX,by-4,2,3,BOOT[2]); p(sx+2+nX,by-4,1,3,BOOT[0]);
      p(sx-3+nX,by-4,1,1,B); p(sx+3+nX,by-4,1,4,B); p(sx-3+nX,by-5,5,1,B); p(sx-3+nX,by,5,1,B);
    }

    // near arm — attached at shoulder, swings with aX
    // Upper sleeve: starts at torso right edge sx+3
    p(sx+3+aX, by-20+bob, 2,1, B);
    p(sx+3+aX, by-19+bob, 2,4, SHIRT[1]);
    p(sx+3+aX, by-19+bob, 1,4, SHIRT[2]);
    p(sx+4+aX, by-19+bob, 1,4, SHIRT[0]);
    p(sx+4+aX, by-19+bob, 1,1, B); p(sx+5+aX,by-19+bob,1,4,B);
    // Forearm/hand
    p(sx+3+aX, by-15+bob, 2,5, SKIN[1]);
    p(sx+3+aX, by-15+bob, 1,5, SKIN[2]);
    p(sx+4+aX, by-15+bob, 1,4, SKIN[0]);
    p(sx+4+aX, by-11+bob, 2,1, B); p(sx+5+aX,by-15+bob,1,5,B);
    p(sx+3+aX, by-15+bob, 1,1, B);

    // neck — sits under chin, pushed right (front)
    p(sx+1, by-22+bob, 3,1, B);
    p(sx+1, by-21+bob, 3,2, SKIN[1]);
    p(sx+3, by-21+bob, 1,2, SKIN[0]);

    // HEAD — proper side profile facing RIGHT
    // Layout: back of head on left (hx), face/nose on right (hx+8)
    // Head is 9w × 12h. Rounded: narrow top/bottom, wide in middle.
    //
    //  ···█████··   hy+0   (top, narrower)
    //  ··███████·   hy+1
    //  ·█████████   hy+2   (widest — forehead)
    //  ·████████·   hy+3   (eye row — face is rightmost cols)
    //  ·████████·   hy+4
    //  ·█████████   hy+5   (nose row — bump at right edge)
    //  ·████████·   hy+6
    //  ·████████·   hy+7   (mouth row)
    //  ·████████·   hy+8
    //  ··███████·   hy+9
    //  ···█████··   hy+10  (chin, narrower)

    const hx=sx-6, hy=by-33+bob;

    // Outline passes (black surround for rounded head shape)
    p(hx+3,hy-1,  5,1, B);  // top
    p(hx+2,hy,    7,1, B);
    p(hx+1,hy+1,  1,9, B);  // left side (back of head)
    p(hx+2,hy+10, 7,1, B);  // bottom
    p(hx+3,hy+11, 5,1, B);  // chin
    p(hx+9,hy+1,  1,4, B);  // face top (forehead edge)
    p(hx+10,hy+5, 1,1, B);  // nose tip
    p(hx+9,hy+6,  1,4, B);  // face bottom (chin edge)

    // Skin fill — build row by row for organic shape
    const S0=SKIN[0], S1=SKIN[1], S2=SKIN[2];
    p(hx+3,hy,    5,1, S1);             // top row
    p(hx+2,hy+1,  7,1, S1);            // forehead top
    p(hx+2,hy+2,  7,8, S1);            // main face block
    p(hx+3,hy+10, 6,1, S1);            // chin
    // Right-side shading (deeper into face = darker)
    p(hx+2,hy+1,  1,9, S2);            // back highlight
    p(hx+3,hy,    1,1, S2);
    p(hx+9,hy+2,  1,3, S0);            // cheek forward shadow
    p(hx+9,hy+6,  1,3, S0);
    // Subtle cheek blush
    ctx.globalAlpha=0.3;
    p(hx+7,hy+5,2,2,isFem?'#e08080':'#c06060');
    ctx.globalAlpha=1;

    // EYE — near the FRONT of the head (right side), not center
    // Eye sits at about 1/3 from front edge
    const ex=hx+6, ey=hy+3;
    p(ex,  ey,   2,3, B);              // eye socket outline
    p(ex,  ey,   2,2, '#1c3460');      // iris
    p(ex,  ey,   1,1, '#d0e4ff');      // catchlight (top-left of iris)
    p(ex,  ey+2, 2,1, B);             // lower lash
    if(isFem){ p(ex-1,ey-1,3,1,B); }  // upper lash
    // brow (above eye, slightly arched)
    p(ex,  ey-2, 2,1, HAIR[0]);
    p(ex-1,ey-2, 1,1, shadeColor(HAIR[0],+15));

    // NOSE — pixel bump at rightmost face edge
    p(hx+9, hy+5, 1,2, S0);           // nose tip (protrudes right)
    p(hx+8, hy+6, 1,1, shadeColor(S0,-15)); // nostril shadow

    // MOUTH — lower face, front half only
    p(hx+7, hy+8, 2,1, B);
    p(hx+7, hy+8, 1,1, S1);
    if(isFem){ p(hx+7,hy+8,2,1,'#bf5560'); p(hx+7,hy+8,1,1,'#d07070'); }

    // EAR — back of head, mid-height (indent on left side)
    p(hx+1, hy+4, 1,3, B);
    p(hx+2, hy+5, 1,2, S0);

    if(HAT){ ctx.save(); ctx.beginPath(); ctx.rect(hx-10, hy, 30, 72); ctx.clip(); }
    _drawHair(ctx,hx,hy,10,12,hs,isFem,HAIR,B,'right');
    if(HAT){ ctx.restore(); }
    _drawHat(ctx,hx+5,by+bob,HAT,B,'right');
  }

  // ─── LEFT ────────────────────────────────────────────────────
  else {
    const by=sy+bob;
    // Mirror of right — near leg strides left(−X) on wf1, right on wf3
    const nX = (wf===1) ? -3 : (wf===3) ?  3 : 0;
    const fX = -nX;
    const aX = -nX;

    // far leg (behind)
    if(!(isFem && ss===1)){
      p(sx+fX,   by-11, 2,11, B);
      p(sx+fX,   by-11, 2, 7, PANTS[0]);
      p(sx+fX,   by- 4, 2, 4, BOOT[0]);
    }

    // far arm (behind torso, dark strip)
    p(sx+1-aX, by-20+bob, 2,10, B);
    p(sx+1-aX, by-20+bob, 2, 5, shadeColor(SHIRT[0],-35));
    p(sx+1-aX, by-15+bob, 2, 5, shadeColor(SKIN[0],-20));

    // torso side — tapered (mirror of right)
    p(sx+3,by-20+bob, 1,1,B); p(sx-5,by-20+bob,1,1,B);
    p(sx-4,by-20+bob, 8,1, SHIRT[2]);
    p(sx-4,by-19+bob, 8,3, SHIRT[1]);
    p(sx-5,by-16+bob,1,1,SHIRT[0]); p(sx+3,by-16+bob,1,1,SHIRT[2]);
    p(sx-4,by-16+bob, 6,4, SHIRT[1]);
    p(sx-4,by-12+bob, 6,1, SHIRT[0]);
    p(sx+3,by-20+bob, 1,9, B); p(sx-5,by-20+bob,1,4,B); p(sx-4,by-16+bob,1,5,B);
    p(sx-4,by-21+bob, 8,1, B); p(sx-4,by-12+bob,6,1,B);

    // near leg — shifts forward (left)
    if(!(isFem && ss===1)){
      p(sx+1+nX,by-12, 1,1, B);
      p(sx-2+nX,by-11, 3,7, PANTS[1]);
      p(sx+1+nX,by-11, 1,7, PANTS[2]);
      p(sx-2+nX,by-11, 1,7, PANTS[0]);
      p(sx+2+nX,by-11, 1,8, B); p(sx-3+nX,by-11,1,8,B);
      // near boot
      p(sx-3+nX,by-4,  5,4, BOOT[1]);
      p(sx+1+nX,by-4,  2,3, BOOT[2]);
      p(sx-3+nX,by-4,  1,3, BOOT[0]);
      p(sx+2+nX,by-4,  1,1, B); p(sx-4+nX,by-4,1,4,B);
      p(sx-1+nX,by-5,  5,1, B); p(sx-1+nX,by,   5,1,B);
    }
    // female prairie dress — side view skirt (left, mirror of right)
    if(isFem && ss===1){
      const sk0=shadeColor(SHIRT[0],-18), sk1=SHIRT[1], sk2=SHIRT[2];
      p(sx-5,by-12+bob, 8,1, sk2);
      p(sx-6,by-11+bob,10,2, sk1);
      p(sx-7,by-9+bob, 12,2, sk0);
      p(sx-8,by-7+bob, 13,2, sk1);
      p(sx-8,by-5+bob, 14,2, sk0);
      p(sx-8,by-3+bob, 14,2, sk1);
      p(sx-5,by-13+bob,8,1,B);
      p(sx+3,by-12+bob,1,2,B); p(sx+4,by-10+bob,1,2,B); p(sx+5,by-8+bob,1,7,B);
      p(sx-6,by-12+bob,1,2,B); p(sx-7,by-10+bob,1,2,B); p(sx-9,by-8+bob,1,7,B);
      p(sx-8,by-1+bob,14,1,B);
    }
    // prairie dress boots — peek out under hem
    if(isFem && ss===1){
      // far boot (darker, behind)
      p(sx+0+fX,by-4,2,4,BOOT[0]); p(sx-1+fX,by-4,1,4,B); p(sx+2+fX,by-4,1,4,B); p(sx+0+fX,by,2,1,B);
      // near boot
      p(sx-3+nX,by-4,5,4,BOOT[1]); p(sx+1+nX,by-4,2,3,BOOT[2]); p(sx-3+nX,by-4,1,3,BOOT[0]);
      p(sx+2+nX,by-4,1,1,B); p(sx-4+nX,by-4,1,4,B); p(sx-1+nX,by-5,5,1,B); p(sx-1+nX,by,5,1,B);
    }

    // near arm — attached at shoulder left edge sx-4
    p(sx-5+aX, by-20+bob, 2,1, B);
    p(sx-5+aX, by-19+bob, 2,4, SHIRT[1]);
    p(sx-4+aX, by-19+bob, 1,4, SHIRT[2]);
    p(sx-5+aX, by-19+bob, 1,4, SHIRT[0]);
    p(sx-5+aX, by-19+bob,1,1,B); p(sx-6+aX,by-19+bob,1,4,B);
    // Forearm/hand
    p(sx-5+aX, by-15+bob, 2,5, SKIN[1]);
    p(sx-4+aX, by-15+bob, 1,5, SKIN[2]);
    p(sx-5+aX, by-15+bob, 1,4, SKIN[0]);
    p(sx-5+aX, by-11+bob, 2,1, B); p(sx-6+aX,by-15+bob,1,5,B);
    p(sx-4+aX, by-15+bob, 1,1, B);

    // neck — pushed left (front side for left-facing)
    p(sx-4, by-22+bob, 3,1, B);
    p(sx-4, by-21+bob, 3,2, SKIN[1]);
    p(sx-4, by-21+bob, 1,2, SKIN[0]);

    // HEAD — proper side profile facing LEFT
    // Mirror of right: face/nose on LEFT side (hx), back of head on RIGHT (hx+9)
    const hx=sx-4, hy=by-33+bob;

    // Outline (rounded head shape, mirrored)
    p(hx+2,hy-1,  5,1, B);  // top
    p(hx+1,hy,    7,1, B);
    p(hx+9,hy+1,  1,9, B);  // right side (back of head)
    p(hx+1,hy+10, 7,1, B);  // bottom
    p(hx+2,hy+11, 5,1, B);  // chin
    p(hx,  hy+1,  1,4, B);  // face top (forehead left edge)
    p(hx-1,hy+5,  1,1, B);  // nose tip
    p(hx,  hy+6,  1,4, B);  // face bottom (chin left edge)

    // Skin fill
    const S0=SKIN[0], S1=SKIN[1], S2=SKIN[2];
    p(hx+2,hy,    5,1, S1);
    p(hx+1,hy+1,  7,1, S1);
    p(hx+1,hy+2,  7,8, S1);
    p(hx+2,hy+10, 6,1, S1);
    // Shading — back of head highlight on right, face shadow on left
    p(hx+8,hy+1,  1,9, S2);  // back-of-head highlight
    p(hx+9,hy,    1,1, S2);
    p(hx+1,hy+2,  1,3, S0);  // cheek forward shadow (left side)
    p(hx+1,hy+6,  1,3, S0);
    // Cheek blush
    ctx.globalAlpha=0.3;
    p(hx+2,hy+5,2,2,isFem?'#e08080':'#c06060');
    ctx.globalAlpha=1;

    // EYE — near the FRONT (left side of head)
    const ex=hx+2, ey=hy+3;
    p(ex,  ey,   2,3, B);
    p(ex,  ey,   2,2, '#1c3460');
    p(ex+1,ey,   1,1, '#d0e4ff');  // catchlight top-right of iris
    p(ex,  ey+2, 2,1, B);
    if(isFem){ p(ex-1,ey-1,4,1,B); }
    // brow
    p(ex,  ey-2, 2,1, HAIR[0]);
    p(ex+2,ey-2, 1,1, shadeColor(HAIR[0],+15));

    // NOSE — protrudes left
    p(hx,  hy+5, 1,2, S0);
    p(hx+1,hy+6, 1,1, shadeColor(S0,-15));

    // MOUTH
    p(hx+2,hy+8, 2,1, B);
    p(hx+3,hy+8, 1,1, S1);
    if(isFem){ p(hx+2,hy+8,2,1,'#bf5560'); p(hx+3,hy+8,1,1,'#d07070'); }

    // EAR — back of head (right side), mid-height
    p(hx+8, hy+4, 1,3, B);
    p(hx+7, hy+5, 1,2, S0);

    if(HAT){ ctx.save(); ctx.beginPath(); ctx.rect(hx-10, hy, 30, 72); ctx.clip(); }
    _drawHair(ctx,hx,hy,10,12,hs,isFem,HAIR,B,'left');
    if(HAT){ ctx.restore(); }
    _drawHat(ctx,hx+5,by+bob,HAT,B,'left');
  }
}