#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// visualCheck.mjs — do the DISPLAYED totals match the EXPECTED totals?
//
//   node server/visualCheck.mjs --file <page.html> \
//     --layout legasus/bench/visual/scoreboard-layout.json \
//     --trace  legasus/bench/visual/trace.json
//
// WHY, and what this is not. Acceptance reads `window.app.state()`. A page can satisfy that while drawing
// something else (`legasus/bench/seq1/deceptive` does exactly that and passes 7 of 7). `renderEvidence`
// only looks for INTERNAL contradictions, and a program that consistently draws the WRONG score satisfies
// it perfectly. So this asks the task-specific question instead: after rendering settles, does the picture
// show the totals the requirement says it should?
//
// THE TWO BOUNDARIES THAT MAKE IT MEANINGFUL:
//
//   1. THE EXPECTED DRAWING IS NEVER DERIVED FROM THE CANDIDATE. It is rendered in a SEPARATE BROWSER
//      PROCESS, on a blank document, from a layout spec and a trace of expected totals that were both
//      written by hand from the requirement. Reading the candidate's own draw calls to decide what it
//      should have drawn would reproduce its mistake and call it agreement.
//   2. EXACT PIXEL COMPARISON IS FOR THIS CONTROLLED FIXTURE ONLY. It is precise when browser, font,
//      viewport and scale factor are pinned - all four are, from the spec - and it is brittle the moment
//      any of them moves, or the layout differs by a pixel. It is NOT a general definition of visual
//      correctness and must not be pointed at arbitrary interfaces. OCR would trade that precision for
//      flexibility and its own misreadings; neither is universally more robust.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, normalize, extname } from 'node:path';
import { createHash } from 'node:crypto';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const SCOPE = 'exact pixel comparison against an independently specified layout, under a pinned browser, font, viewport and scale factor; valid for a fixture that conforms to that layout, and not a general definition of visual correctness';
const sha = (t) => createHash('sha256').update(t).digest('hex');

function serveDir(dirIn) {
  const dir = resolve(dirIn);
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const safe = normalize(rel).replace(/^([.][.][\\/])+/, '');
      const file = resolve(join(dir, safe === '/' || safe === '\\' ? 'index.html' : safe));
      try {
        if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(readFileSync(file));
      } catch { res.writeHead(500); res.end('error'); }
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port }));
  });
}

const launch = async (puppeteer, pinned, browserPath) => {
  let base = {};
  try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back */ }
  return puppeteer.launch({
    ...base, executablePath: browserPath || base.executablePath, headless: true,
    args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage',
      `--force-device-scale-factor=${pinned.deviceScaleFactor}`, '--font-render-hinting=none'],
    timeout: 20_000,
  });
};

/** Grab the declared regions from the first canvas, as raw bytes hashed per region. */
const GRAB = `(layout) => {
  const c = document.querySelector('canvas');
  if (!c) return { error: 'no canvas' };
  const ctx = c.getContext('2d');
  const out = {};
  for (const it of layout.items) {
    const [x0, y0, x1, y1] = it.region;
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let s = '';
    for (let i = 0; i < d.length; i++) s += String.fromCharCode(d[i]);
    out[it.name] = s;
  }
  return { regions: out, width: c.width, height: c.height };
}`;

/**
 * THE TRUSTED REFERENCE. A separate browser, a blank document, and a canvas drawn only from the layout
 * spec and the expected totals. The candidate's code is never loaded here.
 */
async function reference(puppeteer, layout, expectations, browserPath) {
  const browser = await launch(puppeteer, layout.pinned, browserPath);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: layout.pinned.viewport.width, height: layout.pinned.viewport.height, deviceScaleFactor: layout.pinned.deviceScaleFactor });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0"><canvas id="ref" width="${layout.canvas.width}" height="${layout.canvas.height}"></canvas></body></html>`, { waitUntil: 'load' });
    const out = [];
    for (const expect of expectations) {
      const regions = await page.evaluate((lay, exp, grabSrc) => {
        const c = document.getElementById('ref');
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.font = lay.pinned.font;
        ctx.fillStyle = lay.pinned.fillStyle;
        ctx.textBaseline = lay.pinned.textBaseline;
        for (const it of lay.items) {
          const text = it.template.replace(/\{(\w+)\}/g, (_, k) => String(exp[k]));
          ctx.fillText(text, it.x, it.y);
        }
        return (new Function('return ' + grabSrc)())(lay);
      }, layout, expect, GRAB);
      out.push(regions);
    }
    return out;
  } finally { try { await browser.close(); } catch { /* best effort */ } }
}

export async function visualCheck(dir, { layout, trace, entry = 'index.html', browserPath = null } = {}) {
  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch { return { ok: false, reason: 'puppeteer-core is not installed' }; }

  const expectations = trace.steps.map((s) => s.expect);
  // The reference is produced FIRST, in its own browser, before the candidate is loaded anywhere.
  const ref = await reference(puppeteer, layout, expectations, browserPath);

  const { srv, port } = await serveDir(dir);
  const errors = [];
  let browser = null;
  try {
    browser = await launch(puppeteer, layout.pinned, browserPath);
    const page = await browser.newPage();
    await page.setViewport({ width: layout.pinned.viewport.width, height: layout.pinned.viewport.height, deviceScaleFactor: layout.pinned.deviceScaleFactor });
    page.on('pageerror', (e) => errors.push(`[JS ERROR] ${String(e.message || e)}`.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(`[console.error] ${m.text()}`.slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${port}/${entry}`, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForFunction('document.readyState === "complete"', { timeout: 5_000 }).catch(() => {});

    // ── CONFORMANCE FIRST. A page whose canvas is not the size the spec describes is not a subject this
    // check can judge, and saying "the totals are WRONG" about it would conflate two different faults.
    // This was not hypothetical: pointed at a real accepted artefact whose canvas is 200px wide where the
    // spec says 400, the first version reported every total wrong at every step.
    const geom = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { width: c.width, height: c.height } : null;
    });
    // `evaluated` is the field a caller must read. A non-conforming page is OUTSIDE THIS CHECK'S
    // SUPPORTED LAYOUT - not passed, not failed, NOT EVALUATED - and a gate that treated the absence of
    // a mismatch as approval would turn every unsupported layout into a free pass.
    if (!geom) return { ok: true, evaluated: false, verdict: 'LAYOUT_DOES_NOT_CONFORM', reason: 'the page has no canvas', rows: [], mismatched: [], errors, scope: SCOPE };
    if (geom.width !== layout.canvas.width || geom.height !== layout.canvas.height) {
      return {
        ok: true, evaluated: false, verdict: 'LAYOUT_DOES_NOT_CONFORM',
        reason: `the canvas is ${geom.width}x${geom.height} and the layout spec describes ${layout.canvas.width}x${layout.canvas.height}; the totals were NOT judged`,
        geometry: geom, rows: [], mismatched: [], errors, scope: SCOPE,
      };
    }

    const rows = [];
    for (let i = 0; i < trace.steps.length; i++) {
      const s = trace.steps[i];
      if (s.key) { await page.keyboard.press(s.key).catch(() => {}); }
      // Let rendering settle: two animation frames plus a short delay.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await new Promise((r) => setTimeout(r, 40));
      const got = await page.evaluate((lay, grabSrc) => (new Function('return ' + grabSrc)())(lay), layout, GRAB);
      const want = ref[i];
      const perRegion = {};
      let allMatch = true;
      if (got.error || want.error) { allMatch = false; }
      else {
        for (const it of layout.items) {
          const m = got.regions[it.name] === want.regions[it.name];
          perRegion[it.name] = { match: m, gotHash: sha(got.regions[it.name]).slice(0, 12), wantHash: sha(want.regions[it.name]).slice(0, 12) };
          if (!m) allMatch = false;
        }
      }
      rows.push({ step: i, key: s.key, expected: s.expect, allMatch, perRegion, error: got.error || null });
    }
    const mismatched = rows.filter((r) => !r.allMatch);
    return {
      ok: true, evaluated: true, rows, mismatched,
      verdict: mismatched.length === 0 ? 'DISPLAY_MATCHES_EXPECTED' : 'DISPLAY_DOES_NOT_MATCH_EXPECTED',
      errors, geometry: geom, scope: SCOPE,
    };
  } catch (e) {
    return { ok: false, reason: `the check could not run: ${String(e.message || e).slice(0, 200)}` };
  } finally {
    try { if (browser) await browser.close(); } catch { /* best effort */ }
    try { srv.close(); } catch { /* best effort */ }
  }
}

const DIRECT = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const FILE = opt('file', null);
  const LAYOUT = opt('layout', 'legasus/bench/visual/scoreboard-layout.json');
  const TRACE = opt('trace', 'legasus/bench/visual/trace.json');
  if (!FILE) { console.error('usage: node server/visualCheck.mjs --file <page.html> [--layout f] [--trace f]'); process.exit(2); }
  const layout = JSON.parse(readFileSync(LAYOUT, 'utf8'));
  const trace = JSON.parse(readFileSync(TRACE, 'utf8'));
  const ws = mkdtempSync(join(tmpdir(), 'visual-'));
  try {
    writeFileSync(join(ws, 'index.html'), readFileSync(FILE, 'utf8'), 'utf8');
    const r = await visualCheck(ws, { layout, trace });
    if (!r.ok) { console.log(`UNAVAILABLE: ${r.reason}`); process.exit(3); }
    console.log(FILE);
    if (r.verdict === 'LAYOUT_DOES_NOT_CONFORM') {
      console.log(`  LAYOUT_DOES_NOT_CONFORM: ${r.reason}`);
      console.log(`  VERDICT ${r.verdict}   evaluated=${r.evaluated}   (outside this check's supported layout: NOT a finding about the totals, and NOT a pass)`);
      process.exit(2);
    }
    for (const row of r.rows) {
      const bits = Object.entries(row.perRegion).map(([k, v]) => `${k} ${v.match ? 'ok  ' : 'WRONG'}`).join('  ');
      console.log(`  step ${row.step} ${String(row.key ?? 'load').padEnd(5)} expect ${JSON.stringify(row.expected).padEnd(28)} ${bits}${row.error ? '  ' + row.error : ''}`);
    }
    console.log(`\n  errors ${r.errors.length}`);
    console.log(`  VERDICT ${r.verdict}`);
    process.exit(r.verdict === 'DISPLAY_MATCHES_EXPECTED' ? 0 : 1);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
