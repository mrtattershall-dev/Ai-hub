function drawTitleLightningSet(ctx, frame, flashA) {
  const burst = Math.floor(frame / 34);
  const boltSeed = burst * 19 + 7;
  const leftMain = [
    {x: 28 + ((hashNoise(boltSeed + 1) * 6) | 0), y: 0},
    {x: 36 + ((hashNoise(boltSeed + 2) * 10) | 0), y: 18},
    {x: 30 + ((hashNoise(boltSeed + 3) * 16) | 0), y: 40},
    {x: 44 + ((hashNoise(boltSeed + 4) * 14) | 0), y: 67},
    {x: 38 + ((hashNoise(boltSeed + 5) * 18) | 0), y: 95},
    {x: 52 + ((hashNoise(boltSeed + 6) * 18) | 0), y: 126},
  ];
  const rightMain = [
    {x: 219 - ((hashNoise(boltSeed + 7) * 8) | 0), y: 4},
    {x: 208 - ((hashNoise(boltSeed + 8) * 12) | 0), y: 24},
    {x: 217 - ((hashNoise(boltSeed + 9) * 18) | 0), y: 49},
    {x: 198 - ((hashNoise(boltSeed + 10) * 22) | 0), y: 80},
    {x: 208 - ((hashNoise(boltSeed + 11) * 18) | 0), y: 110},
    {x: 189 - ((hashNoise(boltSeed + 12) * 12) | 0), y: 138},
  ];
  drawTitleLightningBolt(ctx, leftMain, '#8cb0ff', PAL.WHITE);
  drawTitleLightningBolt(ctx, rightMain, '#7aa0ff', PAL.WHITE);
  if (flashA > 0.65) {
    drawTitleLightningBolt(ctx, [{x:126,y:22},{x:118,y:38},{x:132,y:54},{x:121,y:70}], '#a8c4ff', PAL.WHITE);
    ctx.fillStyle = PAL.WHITE;
    ctx.fillRect(114, 52, 24, 2);
    ctx.fillRect(122, 46, 8, 14);
  }
}