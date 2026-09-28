#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// observeState.mjs — read a page's state DIRECTLY, as structured data.
//
//   node server/observeState.mjs --file <page.html> [--keys "1,2,3,ArrowUp"] [--expr window.app.state()]
//
// WHY THIS REPLACES THE OLD PROBE. TRANSFER-2's probe read state by asserting `false` on every step so
// that playCheck would print the state inside a FAILURE MESSAGE, then parsing it back out with a regex.
// That was fragile in exactly the way it looks: the regex returned null for a state that was a JSON
// *string*, and it would have disqualified an otherwise-readable page while reporting the WRONG REASON.
//
// This asks the page for its state and returns the value. No assertions, no messages, no parsing.
//
// It is deliberately NOT part of the gate. `playCheck` decides whether a candidate passes and stays
// byte-identical; this only observes, so a change here can never move a verdict.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, normalize, extname } from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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

/**
 * Load the page, read its state, then press each key in turn and read the state again.
 *
 * Returns, for every observation: the VALUE (already structured), whether reading it threw, and the
 * errors raised up to that point. `loadErrors` is kept apart from later errors, because "does it load
 * clean" and "does it survive a dozen key presses" are different questions and one eligibility rule
 * asks only the first.
 */
export async function observe(dir, { expr = 'window.app.state()', keys = [], entry = 'index.html', timeoutMs = 60_000, browserPath = null } = {}) {
  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch { return { ok: false, reason: 'puppeteer-core is not installed' }; }

  const { srv, port } = await serveDir(dir);
  const url = `http://127.0.0.1:${port}/${entry}`;
  const errors = [];
  let browser = null;
  try {
    let base = {};
    try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back */ }
    browser = await puppeteer.launch({
      ...base, executablePath: browserPath || base.executablePath, headless: true,
      args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage'], timeout: 20_000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(`[console.error] ${m.text()}`.slice(0, 300)); });
    page.on('pageerror', (e) => errors.push(`[JS ERROR] ${String(e.message || e)}`.slice(0, 300)));

    await page.goto(url, { waitUntil: 'load', timeout: Math.min(20_000, timeoutMs) });
    await page.waitForFunction('document.readyState === "complete"', { timeout: 5_000 }).catch(() => {});

    // The state is READ and RETURNED. If reading it throws, that is reported as a thrown read rather
    // than folded into the value, so "unreadable" and "read as null" stay distinguishable.
    const read = async () => page.evaluate((e) => {
      try {
        const v = new Function(`return (${e});`)();
        return { threw: false, value: v === undefined ? null : JSON.parse(JSON.stringify(v)), typeOf: typeof v };
      } catch (err) { return { threw: true, message: String(err && err.message || err) }; }
    }, expr);

    const atLoad = await read();
    const loadErrors = errors.slice();
    const observations = [{ after: null, ...atLoad, errorsSoFar: loadErrors.length }];

    for (const k of keys) {
      await page.keyboard.press(k).catch(() => {});
      await new Promise((r) => setTimeout(r, 40));
      observations.push({ after: k, ...(await read()), errorsSoFar: errors.length });
    }

    const readyState = await page.evaluate(() => document.readyState).catch(() => null);
    return { ok: true, url, expr, atLoad, loadErrors, observations, errors, readyState };
  } catch (e) {
    return { ok: false, reason: `the browser could not observe the page: ${String(e.message || e).slice(0, 200)}`, errors };
  } finally {
    try { if (browser) await browser.close(); } catch { /* best effort */ }
    try { srv.close(); } catch { /* best effort */ }
  }
}

/** Which keys CHANGED the state, comparing each observation with the one before it. */
export function respondingKeys(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    const a = obs[i - 1], b = obs[i];
    if (a.threw || b.threw) continue;
    if (JSON.stringify(a.value) !== JSON.stringify(b.value)) out.push(obs[i].after);
  }
  return out;
}

const DIRECT = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const FILE = opt('file', null);
  if (!FILE) { console.error('usage: node server/observeState.mjs --file <page.html> [--keys "a,b"] [--expr ...]'); process.exit(2); }
  const keys = String(opt('keys', '')).split(',').map((k) => k.trim()).filter(Boolean);
  const ws = mkdtempSync(join(tmpdir(), 'observe-'));
  try {
    writeFileSync(join(ws, 'index.html'), readFileSync(FILE, 'utf8'), 'utf8');
    const r = await observe(ws, { keys, expr: opt('expr', 'window.app.state()') });
    if (!r.ok) { console.log(`UNAVAILABLE: ${r.reason}`); process.exit(0); }
    console.log(`readyState ${r.readyState}   errors at load ${r.loadErrors.length}   errors total ${r.errors.length}`);
    for (const e of r.errors.slice(0, 5)) console.log(`  ${e}`);
    console.log(`\nat load: ${r.atLoad.threw ? 'READ THREW: ' + r.atLoad.message : JSON.stringify(r.atLoad.value)}`);
    for (const o of r.observations.slice(1)) {
      console.log(`  after ${String(o.after).padEnd(12)} ${o.threw ? 'READ THREW: ' + o.message : JSON.stringify(o.value)}`);
    }
    console.log(`\nresponding keys: ${respondingKeys(r.observations).join(', ') || 'NONE'}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
