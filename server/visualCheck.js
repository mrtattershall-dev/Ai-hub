/**
 * visualCheck.js - answer "does it actually LOOK right?"
 *
 * WHAT THIS IS, HONESTLY
 * ----------------------
 * The agent's model is Qwen2.5-Coder: text in, text out. It cannot look at an image.
 * So this is NOT vision. Handing it a PNG would be handing it nothing.
 *
 * What it is instead: the page is interrogated from the inside, and the findings are
 * reported as sentences the model can act on. That covers the failure class test_web
 * is structurally blind to - test_web reads the console, so code that throws no error
 * and renders a blank screen passes it cleanly. "Runs fine, shows nothing" was
 * indistinguishable from "works".
 *
 * The screenshot IS still taken and saved, because a human can look at it even though
 * the model cannot. That is what .screenshots/ is for.
 *
 * The checks, and what each one catches:
 *   canvas is blank        - a game that initialises and draws nothing (the big one)
 *   nothing painted        - body renders but every element is empty or hidden
 *   invisible text         - text whose colour matches what is behind it
 *   zero-size elements     - a styled container that collapsed to 0x0
 *   offscreen elements     - laid out beyond the viewport where nobody will see them
 *   overlap of controls    - buttons stacked on top of each other
 */
import { launchOptions } from './browser.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Runs INSIDE the page. Everything here must be self-contained - it is serialised
// across the CDP boundary, so it cannot close over anything from this module.
/* c8 ignore start */
function collect() {
  const out = { canvases: [], issues: [], painted: 0, textLen: 0, viewport: {} };
  out.viewport = { w: window.innerWidth, h: window.innerHeight };

  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';
  };

  // --- canvases: the case that matters most for games ---
  for (const c of document.querySelectorAll('canvas')) {
    const info = { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, blank: null, how: '' };
    if (!c.width || !c.height) { info.blank = true; info.how = 'zero-sized canvas'; out.canvases.push(info); continue; }
    try {
      const ctx = c.getContext('2d');
      if (ctx && typeof ctx.getImageData === 'function') {
        // Sample a grid rather than every pixel: a 1920x1080 readback is slow and
        // a 32x32 grid is more than enough to tell "drawn" from "empty".
        const N = 32;
        const seen = new Set();
        let opaque = 0, total = 0;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = Math.min(c.width - 1, Math.floor((i / N) * c.width));
            const y = Math.min(c.height - 1, Math.floor((j / N) * c.height));
            const d = ctx.getImageData(x, y, 1, 1).data;
            total++;
            if (d[3] > 8) opaque++;
            seen.add(`${d[0]},${d[1]},${d[2]},${d[3]}`);
          }
        }
        info.distinctColors = seen.size;
        info.paintedPct = Math.round((100 * opaque) / total);
        info.how = '2d pixel sample';
        info.blank = seen.size <= 1;
      } else {
        // WebGL (three.js, some Phaser configs). getImageData does not exist, and
        // readPixels needs preserveDrawingBuffer which we do not control. toDataURL
        // on an empty WebGL canvas compresses to near-nothing, so its LENGTH is a
        // crude but reliable "is there anything there" signal.
        const url = c.toDataURL();
        info.how = 'webgl data-url size';
        info.dataUrlBytes = url.length;
        info.blank = url.length < 2000;
      }
    } catch (e) {
      info.how = 'unreadable (' + (e && e.message ? e.message.slice(0, 60) : 'error') + ')';
      info.blank = null;
    }
    out.canvases.push(info);
  }

  // --- DOM: is anything actually visible, and is it visible where a person is looking ---
  const vis = [];
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) vis.push({ el, r, cs });
  }
  out.painted = vis.length;
  out.textLen = (document.body ? document.body.innerText : '').trim().length;

  // invisible text: colour equal to the background behind it
  let invisible = 0;
  for (const v of vis.slice(0, 300)) {
    const t = (v.el.textContent || '').trim();
    if (!t || v.el.children.length) continue;
    if (v.cs.color === bgOf(v.el)) invisible++;
  }
  if (invisible) out.issues.push(`${invisible} element(s) have text the same colour as their background - the text is there but nobody can read it.`);

  // collapsed containers that were clearly meant to show something
  let collapsed = 0;
  for (const el of document.body ? document.body.querySelectorAll('div,section,main,canvas,img') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if ((r.width === 0 || r.height === 0) && (el.children.length || (el.textContent || '').trim())) collapsed++;
  }
  if (collapsed) out.issues.push(`${collapsed} element(s) with content collapsed to zero width or height - a layout/CSS bug, they render nothing.`);

  // laid out where the user cannot see them
  const off = vis.filter((v) => v.r.bottom < 0 || v.r.right < 0
    || v.r.top > window.innerHeight * 3 || v.r.left > window.innerWidth + 50).length;
  if (off) out.issues.push(`${off} visible element(s) are positioned outside the viewport.`);

  // controls stacked on top of one another
  const ctrls = vis.filter((v) => /^(BUTTON|A|INPUT|SELECT)$/.test(v.el.tagName)).slice(0, 40);
  let overlap = 0;
  for (let i = 0; i < ctrls.length; i++) {
    for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i].r, b = ctrls[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) overlap++;
    }
  }
  if (overlap) out.issues.push(`${overlap} pair(s) of controls overlap each other - they will be hard or impossible to click.`);

  return out;
}
/* c8 ignore stop */

/**
 * Load a page, look at it, and describe what is (and is not) on screen.
 * `saveTo` is a directory; the PNG is written there for a human to open.
 */
export async function inspect(url, { saveTo, settleMs = 1200, label = 'screen' } = {}) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { return { ok: false, report: 'ERROR: puppeteer is not installed, cannot look at the page.' }; }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 650 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`[JS ERROR] ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    // Give requestAnimationFrame loops a chance to actually draw a frame - checking a
    // game canvas immediately after load reports "blank" for something that works.
    await new Promise((r) => setTimeout(r, settleMs));

    const facts = await page.evaluate(collect);

    let shot = null;
    if (saveTo) {
      try {
        mkdirSync(saveTo, { recursive: true });
        const file = join(saveTo, `${label}-${Date.now()}.png`);
        const buf = await page.screenshot({ type: 'png' });
        writeFileSync(file, buf);
        shot = file;
      } catch { /* a failed screenshot must not fail the check */ }
    }
    await browser.close();
    return { ok: true, facts, errors, screenshot: shot, report: describe(facts, errors, shot) };
  } catch (e) {
    try { if (browser) await browser.close(); } catch {}
    return { ok: false, report: `ERROR looking at the page: ${e.message}` };
  }
}

/** Turn the facts into prose the model can act on. */
export function describe(f, errors = [], shot = null) {
  const L = [];
  const problems = [];

  L.push(`VISUAL INSPECTION (${f.viewport.w}x${f.viewport.h} viewport)`);
  L.push(`${f.painted} visible element(s), ${f.textLen} characters of visible text.`);

  if (f.canvases.length) {
    for (const [i, c] of f.canvases.entries()) {
      const tag = f.canvases.length > 1 ? ` #${i + 1}` : '';
      if (c.blank === true) {
        problems.push(`The canvas${tag} is BLANK — ${c.w}x${c.h}, nothing has been drawn to it (${c.how}). `
          + `The code runs without errors but the screen is empty. Check that your draw/render call actually executes, `
          + `that the game loop is started, and that anything you draw is inside the canvas bounds.`);
      } else if (c.blank === false) {
        L.push(`Canvas${tag}: ${c.w}x${c.h}, drawn to`
          + (c.distinctColors ? ` (${c.distinctColors} distinct colours, ${c.paintedPct}% of sampled pixels opaque).` : '.'));
      } else {
        L.push(`Canvas${tag}: ${c.w}x${c.h}, could not be read (${c.how}).`);
      }
    }
  } else if (f.painted <= 2 && f.textLen < 5) {
    problems.push('The page renders essentially NOTHING — no canvas, almost no elements, no text. '
      + 'Whatever you built is not reaching the screen.');
  }

  for (const i of f.issues) problems.push(i);
  for (const e of errors) problems.push(e);

  if (problems.length) {
    L.push('');
    L.push('PROBLEMS:');
    problems.forEach((p, i) => L.push(`  ${i + 1}. ${p}`));
    L.push('');
    L.push('Fix these before finishing. A page with no errors that shows nothing is still broken.');
  } else {
    L.push('');
    L.push('No visual problems found: content is on screen, sized, and within the viewport.');
  }
  if (shot) L.push(`\n(Screenshot saved for the human: ${shot})`);
  return L.join('\n');
}

/** Did the inspection find something that should block finishing? */
export function hasProblems(r) {
  if (!r || !r.ok || !r.facts) return false;
  return r.facts.canvases.some((c) => c.blank === true)
    || r.facts.issues.length > 0
    || (r.facts.canvases.length === 0 && r.facts.painted <= 2 && r.facts.textLen < 5);
}
