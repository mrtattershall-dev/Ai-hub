function drawTitleMenuArt(ctx, menuYOffset, lightningAlpha, flashAlpha, reveal) {
  /* ── Sky: deep gradient emulated via two-tone bands ── */
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, NES.W, NES.H);
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0, 130, NES.W, 50);

  ctx.fillStyle = PAL.LIGHTGRAY;
  for (let i = 0; i < 36; i++) {
    const a  = (i / 36) * Math.PI * 2;
    const mx = (48 + Math.cos(a) * 22) | 0;
    const my = (45 + Math.sin(a) * 22) | 0;
    ctx.fillRect(mx, my, 2, 2);
  }
  for (let dy = -21; dy <= 21; dy++) {
    const hw = Math.sqrt(Math.max(0, 21*21 - dy*dy)) | 0;
    ctx.fillRect(48 - hw, 45 + dy, hw*2, 1);
  }
  ctx.fillStyle = '#000008';
  for (let dy = -18; dy <= 18; dy++) {
    const hw = Math.sqrt(Math.max(0, 18*18 - dy*dy)) | 0;
    ctx.fillRect(54 - hw, 40 + dy, hw*2, 1);
  }
  ctx.fillStyle = PAL.MIDGRAY;
  [[38,48,3],[44,56,2],[52,44,2]].forEach(([mx,my,r]) => {
    ctx.fillRect(mx, my, r, 1);
    ctx.fillRect(mx, my+1, r+1, 1);
  });

  const stars1 = [[90,12],[120,8],[160,20],[200,15],[230,30],[15,25],[70,35]];
  const stars2 = [[110,30],[180,10],[240,22],[30,18],[150,6]];
  ctx.fillStyle = PAL.WHITE;
  stars1.forEach(([sx,sy]) => ctx.fillRect(sx,sy,1,1));
  stars2.forEach(([sx,sy]) => ctx.fillRect(sx,sy,2,2));
  ctx.fillStyle = PAL.PALE_GOLD;
  if (Math.floor(G.frame / 20) % 3 === 0) ctx.fillRect(90,12,2,2);
  if (Math.floor(G.frame / 20) % 3 === 1) ctx.fillRect(160,20,2,2);
  if (Math.floor(G.frame / 20) % 3 === 2) ctx.fillRect(230,30,2,2);

  if (lightningAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = lightningAlpha;
    drawTitleLightningSet(ctx, titleScreen.animFrame, flashAlpha);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, menuYOffset);

  ctx.fillStyle = '#1a1020';
  ctx.fillRect(0, 148, NES.W, NES.H - 148);
  ctx.fillRect(80,  118, 96, 30);
  ctx.fillRect(140, 90,  16, 58);
  ctx.fillRect(170, 115, 50, 35);
  ctx.fillRect(30,  128, 40, 20);

  ctx.fillStyle = PAL.STONE_DARK;
  ctx.fillRect(0, 160, NES.W, NES.H - 160);
  ctx.fillRect(96, 100, 64, 60);
  [96,108,120,132,144,156].forEach(bx => ctx.fillRect(bx, 94, 8, 8));
  ctx.fillRect(120, 68, 16, 32);
  ctx.fillRect(124, 56, 8, 14);
  ctx.fillRect(127, 46, 2, 12);
  ctx.fillRect(8, 118, 36, 42);
  [8,18,28].forEach(bx => ctx.fillRect(bx, 112, 7, 8));
  ctx.fillRect(208, 120, 40, 40);
  [208,220,232].forEach(bx => ctx.fillRect(bx, 114, 8, 8));
  ctx.fillRect(56, 128, 32, 32);
  [56,66,76].forEach(bx => ctx.fillRect(bx, 122, 8, 8));
  ctx.fillRect(168, 124, 32, 36);
  [168,178,188].forEach(bx => ctx.fillRect(bx, 118, 8, 8));

  if (flashAlpha > 0.05) {
    ctx.save();
    ctx.globalAlpha = flashAlpha * 0.9;
    ctx.fillStyle = '#3b3550';
    ctx.fillRect(96, 100, 64, 60);
    ctx.fillRect(120, 68, 16, 32);
    ctx.fillRect(124, 56, 8, 14);
    ctx.fillRect(8, 118, 36, 42);
    ctx.fillRect(208, 120, 40, 40);
    ctx.fillRect(56, 128, 32, 32);
    ctx.fillRect(168, 124, 32, 36);
    ctx.fillStyle = '#c8d6ff';
    ctx.fillRect(126, 62, 4, 8);
    ctx.fillRect(121, 79, 14, 12);
    ctx.fillRect(108, 113, 8, 16);
    ctx.fillRect(136, 114, 8, 18);
    ctx.restore();
  }

  drawPxText(ctx, 'CURSEBOUND', NES.W/2 + 2, 56 + 2, 2, PAL.BLOOD_RED, 'center');
  drawPxText(ctx, 'CURSEBOUND', NES.W/2, 56, 2, PAL.PALE_GOLD, 'center');
  drawPxText(ctx, 'A HORRIBLE NIGHT TO HAVE A CURSE', NES.W/2, 84, 1, PAL.LIGHTGRAY, 'center');

  ctx.fillStyle = PAL.BLOOD_RED;
  ctx.fillRect(32, 92, NES.W - 64, 2);
  ctx.fillRect(30, 90, 4, 6);
  ctx.fillRect(NES.W-34, 90, 4, 6);

  if (titleScreen.showPrompt && reveal > 0.98) {
    drawPxText(ctx, 'PRESS START', NES.W/2, 108, 1, PAL.WHITE, 'center', true);
  }

  const controlsA = clamp01((reveal - 0.78) / 0.22);
  if (controlsA > 0) {
    ctx.save();
    ctx.globalAlpha = controlsA;
    drawPxText(ctx, 'D-PAD=MOVE  A=JUMP  B=ATTACK', NES.W/2, 130, 1, PAL.MIDGRAY, 'center');
    drawPxText(ctx, 'START=START  SELECT=WEAPON', NES.W/2, 140, 1, PAL.MIDGRAY, 'center');
    drawPxText(ctx, 'NES JAM 2026', NES.W/2, NES.H - 12, 1, '#2a2a2a', 'center');
    ctx.restore();
  }
  ctx.restore();

  if (flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flashAlpha * 0.32;
    ctx.fillStyle = PAL.WHITE;
    ctx.fillRect(0, 0, NES.W, 150);
    ctx.restore();
  }
};