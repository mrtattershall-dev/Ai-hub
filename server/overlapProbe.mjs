#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// overlapProbe.mjs — do two drawn labels actually COLLIDE in painted pixels?
//
//   node server/overlapProbe.mjs --width 200 --font "20px Arial" \
//     --a "Player A: 0" --ax 10 --ay 20  --b "Player B: 0" --bx 90 --by 20
//
// measureText().width is an ADVANCE width, not the painted bounding box: it includes side bearings and
// excludes ink that overhangs them. Two advance spans can overlap with no pixel painted twice, and two
// that do not overlap can still collide through overhang. So this paints each label ALONE on its own
// canvas, builds a mask of which pixels each one inked, and counts the pixels inked by BOTH.
//
// That count is the claim. Anything less is an inference from metrics.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const W = parseInt(opt('width', '200'), 10);
const H = parseInt(opt('height', '100'), 10);
const FONT = opt('font', '20px Arial');
const A = opt('a', 'Player A: 0'), AX = parseFloat(opt('ax', '10')), AY = parseFloat(opt('ay', '20'));
const B = opt('b', 'Player B: 0'), BX = parseFloat(opt('bx', '90')), BY = parseFloat(opt('by', '20'));
const SHOT = opt('screenshot', null);

const puppeteer = (await import('puppeteer-core')).default;
let base = {};
try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back */ }
const browser = await puppeteer.launch({ ...base, headless: true, args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--font-render-hinting=none'], timeout: 20_000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
    <canvas id="a" width="${W}" height="${H}"></canvas>
    <canvas id="b" width="${W}" height="${H}"></canvas>
    <canvas id="both" width="${W}" height="${H}"></canvas>
  </body></html>`, { waitUntil: 'load' });

  const r = await page.evaluate((cfg) => {
    const ink = (id, text, x, y) => {
      const c = document.getElementById(id);
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = cfg.font; ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const mask = new Uint8Array(c.width * c.height);
      let minX = c.width, maxX = -1;
      for (let p = 0, i = 3; i < d.length; i += 4, p++) {
        if (d[i] !== 0) {
          mask[p] = 1;
          const x2 = p % c.width;
          if (x2 < minX) minX = x2;
          if (x2 > maxX) maxX = x2;
        }
      }
      return { mask: Array.from(mask), minX, maxX, painted: mask.reduce((n, v) => n + v, 0) };
    };
    const a = ink('a', cfg.a, cfg.ax, cfg.ay);
    const b = ink('b', cfg.b, cfg.bx, cfg.by);
    let both = 0;
    for (let i = 0; i < a.mask.length; i++) if (a.mask[i] && b.mask[i]) both++;

    // And the two together on one canvas, which is what a user would see.
    const c = document.getElementById('both');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = cfg.font; ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(cfg.a, cfg.ax, cfg.ay);
    ctx.fillText(cfg.b, cfg.bx, cfg.by);

    const ctxM = document.getElementById('a').getContext('2d');
    const advanceA = ctxM.measureText(cfg.a).width;
    const advanceB = ctxM.measureText(cfg.b).width;
    return {
      aPaintedColumns: [a.minX, a.maxX], bPaintedColumns: [b.minX, b.maxX],
      aPaintedPixels: a.painted, bPaintedPixels: b.painted, pixelsPaintedByBoth: both,
      advanceA, advanceB,
      advanceSpansOverlap: (cfg.ax + advanceA) > cfg.bx,
      paintedColumnsOverlap: a.maxX >= b.minX,
    };
  }, { font: FONT, a: A, ax: AX, ay: AY, b: B, bx: BX, by: BY });

  console.log(`canvas ${W}x${H}   font ${FONT}`);
  console.log(`  "${A}" at x=${AX}: painted columns ${r.aPaintedColumns[0]}..${r.aPaintedColumns[1]}, ${r.aPaintedPixels} px inked, advance width ${r.advanceA.toFixed(1)}`);
  console.log(`  "${B}" at x=${BX}: painted columns ${r.bPaintedColumns[0]}..${r.bPaintedColumns[1]}, ${r.bPaintedPixels} px inked, advance width ${r.advanceB.toFixed(1)}`);
  console.log(`\n  advance spans overlap      : ${r.advanceSpansOverlap}   (a metric, not the picture)`);
  console.log(`  painted COLUMNS overlap    : ${r.paintedColumnsOverlap}`);
  console.log(`  PIXELS PAINTED BY BOTH     : ${r.pixelsPaintedByBoth}`);
  console.log(`\n  VERDICT ${r.pixelsPaintedByBoth > 0 ? 'GLYPHS COLLIDE - the same pixels are inked by both labels'
    : (r.paintedColumnsOverlap ? 'COLUMNS OVERLAP but no pixel is inked twice - the labels interleave without colliding'
    : 'NO OVERLAP')}`);

  if (SHOT) {
    const el = await page.$('#both');
    await el.screenshot({ path: SHOT });
    console.log(`\n  screenshot of the two together written to ${SHOT}`);
  }
} finally { try { await browser.close(); } catch { /* best effort */ } }
