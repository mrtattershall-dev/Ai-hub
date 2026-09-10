function wrap(ctx, str, x, y, maxW, lineH, opts) {
  ctx.font = `${opts.weight ?? 600} ${opts.size}px "Segoe UI", system-ui, sans-serif`;
  const words = str.split(" ");
  let line = "", ly = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      text(ctx, line, x, ly, opts); line = w; ly += lineH;
    } else line = test;
  }
  if (line) text(ctx, line, x, ly, opts);
}