function drawPxText(ctx, str, x, y, scale, color, align, shadow) {
  const s    = scale  || 1;
  const aln  = align  || 'left';
  const text = String(str);
  const tw   = text.length * FONT_GW * s;

  let drawX = x;
  if (aln === 'center') drawX = x - (tw >> 1);
  if (aln === 'right')  drawX = x - tw;

  if (shadow) {
    ctx.fillStyle = PAL.BLACK;
    for (let i = 0; i < text.length; i++) {
      drawPxChar(ctx, text[i], drawX + i * FONT_GW * s + s, y + s, s);
    }
  }

  ctx.fillStyle = color || PAL.WHITE;
  for (let i = 0; i < text.length; i++) {
    drawPxChar(ctx, text[i], drawX + i * FONT_GW * s, y, s);
  }
}