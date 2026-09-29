// 像素图形工具：在低分辨率离屏画布上程序化绘制精灵，
// 再用后处理自动生成以撒标志性的粗黑描边。
// 世界坐标单位 == 精灵像素，最终由渲染层统一整数倍放大（关闭插值）。

/**
 * 创建一块低分辨率离屏画布。
 * 尺寸必须取整 —— canvas.width 会把小数截断，而后处理是按逻辑宽度做行索引的，
 * 两者一旦对不上，整张图的像素索引就会逐行错位。
 */
export function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { canvas: c, g, w, h };
}

// ---------------------------------------------------------------------------
// 像素级绘制原语：全部对齐到整数像素，避免出现半透明的抗锯齿边缘
// ---------------------------------------------------------------------------

export function pset(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, 1, 1);
}

export function prect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** 实心椭圆（中心 cx,cy，半径 rx,ry），逐行扫描保证边缘是硬像素 */
export function pellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = Math.ceil(-ry); y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const half = Math.sqrt(t) * rx;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    g.fillRect(x0, Math.round(cy + y), Math.max(1, x1 - x0), 1);
  }
}

export function pcircle(g, cx, cy, r, color) {
  pellipse(g, cx, cy, r, r, color);
}

/** 半个椭圆：side = 'top' | 'bottom' | 'left' | 'right' */
export function phalf(g, cx, cy, rx, ry, color, side) {
  g.fillStyle = color;
  for (let y = Math.ceil(-ry); y <= ry; y++) {
    if (side === 'top' && y > 0) continue;
    if (side === 'bottom' && y < 0) continue;
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    let half = Math.sqrt(t) * rx;
    let x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    if (side === 'left') x1 = Math.round(cx);
    if (side === 'right') x0 = Math.round(cx);
    if (x1 <= x0) continue;
    g.fillRect(x0, Math.round(cy + y), x1 - x0, 1);
  }
}

/** Bresenham 直线 */
export function pline(g, x0, y0, x1, y1, color) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pset(g, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// ---------------------------------------------------------------------------
// 后处理
// ---------------------------------------------------------------------------

/**
 * 给所有不透明像素外围加一圈描边——以撒所有角色都有这种粗黑轮廓。
 * 会先把半透明像素二值化，保证描边干净。
 */
export function outline(ctx, color = '#1a0d0a', thickness = 1) {
  const { g, w, h } = ctx;
  for (let pass = 0; pass < thickness; pass++) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 128 ? 1 : 0;

    const [cr, cg, cb] = hexToRgb(color);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        // 四邻域有实心像素则描边
        const near =
          (x > 0 && solid[i - 1]) ||
          (x < w - 1 && solid[i + 1]) ||
          (y > 0 && solid[i - w]) ||
          (y < h - 1 && solid[i + w]);
        if (!near) continue;
        const p = i * 4;
        d[p] = cr; d[p + 1] = cg; d[p + 2] = cb; d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  return ctx;
}

/** 生成一份整体染色的副本（用于冠军怪 / 受击闪白 / 幽灵化） */
export function tinted(src, color, alpha = 1) {
  const c = makeCanvas(src.w, src.h);
  c.g.drawImage(src.canvas, 0, 0);
  c.g.globalCompositeOperation = 'source-atop';
  c.g.globalAlpha = alpha;
  c.g.fillStyle = color;
  c.g.fillRect(0, 0, src.w, src.h);
  c.g.globalAlpha = 1;
  c.g.globalCompositeOperation = 'source-over';
  return c;
}

/** 生成纯剪影（受击闪白用） */
export function silhouette(src, color = '#ffffff') {
  return tinted(src, color, 1);
}

/** 垂直翻转副本 */
export function flipX(src) {
  const c = makeCanvas(src.w, src.h);
  c.g.translate(src.w, 0);
  c.g.scale(-1, 1);
  c.g.drawImage(src.canvas, 0, 0);
  return c;
}

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 颜色变暗 / 变亮，用于自动生成阴影与高光色 */
export function shade(hex, amt) {
  let [r, g, b] = hexToRgb(hex);
  r = Math.round(Math.min(255, Math.max(0, r + amt)));
  g = Math.round(Math.min(255, Math.max(0, g + amt)));
  b = Math.round(Math.min(255, Math.max(0, b + amt)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * 精灵定义辅助：创建画布、执行绘制、加描边，返回带锚点的精灵对象。
 * anchor 默认为底部中心（脚下），符合俯视角角色的站立点。
 */
export function makeSprite(w, h, drawFn, opts = {}) {
  const ctx = makeCanvas(w, h);
  w = ctx.w; h = ctx.h;
  drawFn(ctx.g, w, h);
  if (opts.outline !== false) {
    outline(ctx, opts.outlineColor || '#1a0d0a', opts.outlineWidth || 1);
  }
  return {
    canvas: ctx.canvas,
    w, h,
    ax: opts.ax !== undefined ? opts.ax : w / 2,
    ay: opts.ay !== undefined ? opts.ay : h,
  };
}

/** 以锚点为基准把精灵画到目标 ctx 的世界坐标 (x,y) */
export function drawSprite(g, sp, x, y, opts = {}) {
  const sx = Math.round(x - sp.ax);
  const sy = Math.round(y - sp.ay);
  if (opts.alpha !== undefined && opts.alpha < 1) {
    const prev = g.globalAlpha;
    g.globalAlpha = prev * opts.alpha;
    g.drawImage(sp.canvas, sx, sy);
    g.globalAlpha = prev;
  } else {
    g.drawImage(sp.canvas, sx, sy);
  }
}
