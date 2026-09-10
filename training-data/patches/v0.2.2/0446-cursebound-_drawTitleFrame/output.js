function _drawTitleFrame(ctx, af, showPrompt) {
  const menuDrop   = 92 * (1 - _tEaseOut(Math.min(1, af/116)));
  const introT     = _tClamp01(af / TITLE_INTRO_FRAMES);
  const titleReveal = _tEaseIO(_tClamp01((af-18)/78));
  let flashAlpha = 0, lightningAlpha = 0.16 + (1-introT)*0.10;
  const FLASHES = [12,16,18,44,47,74,77,80,112,116,154,159];
  for (const f of FLASHES) {
    const d = Math.abs(af - f);
    if (d<=1)  flashAlpha = Math.max(flashAlpha, 1.00);
    else if (d<=3)  flashAlpha = Math.max(flashAlpha, 0.72);
    else if (d<=6)  flashAlpha = Math.max(flashAlpha, 0.44);
    else if (d<=10) flashAlpha = Math.max(flashAlpha, 0.18);
    if (d<=7) lightningAlpha = Math.max(lightningAlpha, 0.95 - d*0.11);
  }

  /* Sky */
  ctx.fillStyle = '#000008'; ctx.fillRect(0,0,NES.W,NES.H);
  ctx.fillStyle = '#0a0614'; ctx.fillRect(0,130,NES.W,50);

  /* Crescent moon */
  ctx.fillStyle = PAL.LIGHTGRAY;
  for (let dy=-21;dy<=21;dy++){const hw=Math.sqrt(Math.max(0,21*21-dy*dy))|0;ctx.fillRect(48-hw,45+dy,hw*2,1);}
  ctx.fillStyle='#000008';
  for (let dy=-18;dy<=18;dy++){const hw=Math.sqrt(Math.max(0,18*18-dy*dy))|0;ctx.fillRect(54-hw,40+dy,hw*2,1);}
  ctx.fillStyle=PAL.MIDGRAY;
  [[38,48,3],[44,56,2],[52,44,2]].forEach(([mx,my,r])=>{ctx.fillRect(mx,my,r,1);ctx.fillRect(mx,my+1,r+1,1);});

  /* Stars */
  ctx.fillStyle=PAL.WHITE;
  [[90,12],[120,8],[160,20],[200,15],[230,30],[15,25],[70,35]].forEach(([sx,sy])=>ctx.fillRect(sx,sy,1,1));
  [[110,30],[180,10],[240,22],[30,18],[150,6]].forEach(([sx,sy])=>ctx.fillRect(sx,sy,2,2));
  ctx.fillStyle=PAL.PALE_GOLD;
  if (Math.floor(G.frame/20)%3===0) ctx.fillRect(90,12,2,2);
  if (Math.floor(G.frame/20)%3===1) ctx.fillRect(160,20,2,2);
  if (Math.floor(G.frame/20)%3===2) ctx.fillRect(230,30,2,2);

  /* Lightning */
  /* Lightning: NES 1-frame absolute flash — show only on peak frames */
  if (lightningAlpha > 0.6) {
    _drawLightningSet(ctx, af, flashAlpha);
  }

  /* Castle + UI — drops in from above */
  ctx.save();
  ctx.translate(0, Math.round(menuDrop + TITLE_MENU_SETTLE_Y));

  /* Castle silhouette — dark layer */
  ctx.fillStyle='#1a1020';
  ctx.fillRect(0,148,NES.W,NES.H-148); ctx.fillRect(80,118,96,30);
  ctx.fillRect(140,90,16,58); ctx.fillRect(170,115,50,35); ctx.fillRect(30,128,40,20);

  /* Castle — main stone */
  ctx.fillStyle=PAL.STONE_DARK;
  ctx.fillRect(0,160,NES.W,NES.H-160);
  ctx.fillRect(96,100,64,60);
  [96,108,120,132,144,156].forEach(bx=>ctx.fillRect(bx,94,8,8));
  ctx.fillRect(120,68,16,32); ctx.fillRect(124,56,8,14); ctx.fillRect(127,46,2,12);
  ctx.fillRect(8,118,36,42);
  [8,18,28].forEach(bx=>ctx.fillRect(bx,112,7,8));
  ctx.fillRect(208,120,40,40);
  [208,220,232].forEach(bx=>ctx.fillRect(bx,114,8,8));
  ctx.fillRect(56,128,32,32);
  [56,66,76].forEach(bx=>ctx.fillRect(bx,122,8,8));
  ctx.fillRect(168,124,32,36);
  [168,178,188].forEach(bx=>ctx.fillRect(bx,118,8,8));

  /* Castle flash lit by lightning */
  /* Castle lightning flash — NES: draw on peak frame only, no alpha */
  if (flashAlpha > 0.5 && G.frame % 2 === 0) {
    ctx.fillStyle = PAL.STONE_MID;
    ctx.fillRect(96,100,64,60); ctx.fillRect(120,68,16,32); ctx.fillRect(124,56,8,14);
    ctx.fillRect(8,118,36,42); ctx.fillRect(208,120,40,40);
    ctx.fillRect(56,128,32,32); ctx.fillRect(168,124,32,36);
    ctx.fillStyle = PAL.STONE_HIGH;
    ctx.fillRect(126,62,4,8); ctx.fillRect(121,79,14,12);
    ctx.fillRect(108,113,8,16); ctx.fillRect(136,114,8,18);
  }

  /* Title text — reveals with easing */
  /* Title text — NES snap-in: visible once reveal threshold passed */
  if (titleReveal > 0.15) {
    drawPxText(ctx,'CURSEBOUND',NES.W/2+2,58,2,PAL.BLOOD_RED,'center');
    drawPxText(ctx,'CURSEBOUND',NES.W/2,56,2,PAL.PALE_GOLD,'center');
    drawPxText(ctx,'A HORRIBLE NIGHT TO HAVE A CURSE',NES.W/2,84,1,PAL.LIGHTGRAY,'center');
    ctx.fillStyle=PAL.BLOOD_RED;
    ctx.fillRect(32,92,NES.W-64,2); ctx.fillRect(30,90,4,6); ctx.fillRect(NES.W-34,90,4,6);
  }

  /* PRESS START — only after animation completes */
  if (showPrompt && af >= TITLE_INTRO_FRAMES) {
    drawPxText(ctx,'PRESS START',NES.W/2,108,1,PAL.WHITE,'center',true);
  }

  /* Controls — fade in at end of reveal */
  if (titleReveal > 0.78) {
    drawPxText(ctx,'D-PAD=MOVE  A=JUMP  B=ATTACK',NES.W/2,130,1,PAL.MIDGRAY,'center');
    drawPxText(ctx,'START=START  SELECT=WEAPON',NES.W/2,140,1,PAL.MIDGRAY,'center');
    drawPxText(ctx,'NES JAM 2026',NES.W/2,NES.H-12,1,PAL.STONE_DARK,'center');
  }
  ctx.restore();

  /* Full-screen flash overlay */
  /* Flash: NES 1-frame absolute fill — no alpha, just on/off */
  if (flashAlpha > 0.6) {
    ctx.fillStyle = PAL.WHITE;
    ctx.fillRect(0, 0, NES.W, 150);
  }
}