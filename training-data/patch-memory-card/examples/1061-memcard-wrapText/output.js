function wrapText(ctx, str, x, y, maxW, lineH, opts) {
  ctx.font = `${opts.weight ?? 600} ${opts.size}px "Segoe UI", system-ui, sans-serif`;
  const words = str.split(" ");
  let line = "";
  let ly = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      text(ctx, line, x, ly, opts);
      line = word;
      ly += lineH;
    } else {
      line = test;
    }
  }
  if (line) text(ctx, line, x, ly, opts);
}