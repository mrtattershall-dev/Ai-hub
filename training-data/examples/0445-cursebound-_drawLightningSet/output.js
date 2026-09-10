function _drawLightningSet(ctx, frame, flashA) {
  const seed = Math.floor(frame/34)*19 + 7;
  const L = [
    {x: 28+(((_tHash(seed+1)*6)|0)), y:0},
    {x: 36+(((_tHash(seed+2)*10)|0)), y:18},
    {x: 30+(((_tHash(seed+3)*16)|0)), y:40},
    {x: 44+(((_tHash(seed+4)*14)|0)), y:67},
    {x: 38+(((_tHash(seed+5)*18)|0)), y:95},
    {x: 52+(((_tHash(seed+6)*18)|0)), y:126},
  ];
  const R = [
    {x: 219-(((_tHash(seed+7)*8)|0)),  y:4},
    {x: 208-(((_tHash(seed+8)*12)|0)), y:24},
    {x: 217-(((_tHash(seed+9)*18)|0)), y:49},
    {x: 198-(((_tHash(seed+10)*22)|0)),y:80},
    {x: 208-(((_tHash(seed+11)*18)|0)),y:110},
    {x: 189-(((_tHash(seed+12)*12)|0)),y:138},
  ];
  _drawLightningBolt(ctx, L, '#8cb0ff', PAL.WHITE);
  _drawLightningBolt(ctx, R, '#7aa0ff', PAL.WHITE);
  if (flashA > 0.65) {
    _drawLightningBolt(ctx, [{x:126,y:22},{x:118,y:38},{x:132,y:54},{x:121,y:70}], '#a8c4ff', PAL.WHITE);
    ctx.fillStyle = PAL.WHITE;
    ctx.fillRect(114,52,24,2); ctx.fillRect(122,46,8,14);
  }
}