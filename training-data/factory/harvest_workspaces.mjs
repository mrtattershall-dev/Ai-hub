/**
 * harvest_workspaces.mjs - keep small permissively-licensed games that ACTUALLY BOOT, whole,
 * as starting workspaces for "edit an existing game" goals.
 *
 *   node factory/harvest_workspaces.mjs [--repos factory/repos_wide_clonable.json]
 *        [--maxmb 3] [--offset 0] [--limit 40]
 *        [--dest factory/raw/workspaces] [--out factory/raw/workspaces_manifest.jsonl]
 *   node factory/harvest_workspaces.mjs --one <owner/name> [--license L --stars N --mb M]
 *        [--dest DIR] [--work DIR]
 *        one repo only; prints its manifest row as a line "ROW {...}" (what a Modal container
 *        runs - see modal_harvest_ws.py). Nothing is appended to a manifest in this mode.
 *
 * WHY WHOLE REPOS, AND WHY "BOOTS"
 * --------------------------------
 * harvest_pipeline.mjs mines FUNCTIONS and throws the clone away. A 20-repo probe
 * (2026-09-11) showed only 4 of 55 harvested functions can carry an automatic check on their
 * own - game code needs its page, its canvas, its engine. But that is exactly the task the 14B
 * fails at in the hub: editing an EXISTING game (it appended a second update(), crashed on a
 * variable used before its declaration, never wired the new collision check into the loop).
 * So the unit of harvest here is a whole small game that boots, kept as a workspace, so a goal
 * can say "In the EXISTING game, add ..." and a checker can load it in a browser before and
 * after.
 *
 * A game is kept only if one of its HTML pages, served over http, loads with ZERO page errors,
 * stays on the local server, and draws something on a canvas. "Drawn" and "animating" are
 * judged from screenshots of the canvas element, not from getImageData / toDataURL: a WebGL
 * canvas (most Phaser games) reads back blank through toDataURL unless the game opted into
 * preserveDrawingBuffer, which would reject working games as blank. Locally, CDN scripts come
 * from the hub's engine cache (the same one test_web uses), so a CDN blip is never recorded as
 * a broken game; inside a container (no hub checkout) they come straight from the network.
 *
 * LICENCES AND WHERE THE CODE GOES
 * --------------------------------
 * Input is the "permissive" list only (MIT, Apache-2.0, BSD, ISC, Zlib, MPL, Unlicense, CC0,
 * WTFPL...), with the licence recorded per repo. Workspaces land in factory/raw/ - gitignored,
 * never committed, never published. Each keeps the repo's own LICENSE file, and the manifest
 * row records repo, licence, stars and the exact commit, so provenance is per workspace.
 * Resume-safe: every repo attempted gets a manifest row, and a rerun skips those.
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, cpSync } from 'fs';
import { join, extname, relative, sep, dirname, resolve } from 'path';
import { execFileSync } from 'child_process';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..', '..', 'server');

// The hub's puppeteer, launch options and engine cache when this runs inside the repo; plain
// puppeteer next to this file when it runs in a container that has no hub checkout.
let puppeteer;
let launchOptions = () => ({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let serveScriptsFromCache = async () => [];
const HUB = existsSync(join(SERVER, 'browser.js')) && existsSync(join(SERVER, 'engineCache.js'));
if (HUB) {
  puppeteer = createRequire(join(SERVER, 'index.js'))('puppeteer');
  ({ launchOptions } = await import(pathToFileURL(join(SERVER, 'browser.js')).href));
  ({ serveScriptsFromCache } = await import(pathToFileURL(join(SERVER, 'engineCache.js')).href));
} else {
  puppeteer = createRequire(import.meta.url)('puppeteer');
}

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const ONE = flag('one', null);
const REPOS = flag('repos', join(HERE, 'repos_wide_clonable.json'));
const MAX_MB = Number(flag('maxmb', 3));
const OFFSET = Number(flag('offset', 0));
const LIMIT = Number(flag('limit', 40));
const DEST = resolve(flag('dest', join(HERE, 'raw', 'workspaces')));
const OUT = resolve(flag('out', join(HERE, 'raw', 'workspaces_manifest.jsonl')));
const WORK = resolve(flag('work', join(tmpdir(), 'harvest-ws-work')));

const SKIP_DIR = new Set(['node_modules', '.git', '.github', '.vscode', '.idea', '__pycache__']);
const MIME = { '.html': 'text/html', '.htm': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml',
  '.txt': 'text/plain', '.wasm': 'application/wasm', '.fnt': 'text/plain', '.atlas': 'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function walk(root, pred, depth = 0, out = []) {
  if (depth > 6) return out;
  let ents = [];
  try { ents = readdirSync(root); } catch { return out; }
  for (const e of ents) {
    if (SKIP_DIR.has(e)) continue;
    const p = join(root, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, pred, depth + 1, out);
    else if (pred(p, st)) out.push(p);
  }
  return out;
}
const dirBytes = (root) => walk(root, () => true).reduce((s, p) => { try { return s + statSync(p).size; } catch { return s; } }, 0);

/** HTML pages worth booting: they have a canvas, or load a script that could make one. Root index first. */
function candidatePages(root) {
  const pages = walk(root, (p, st) => /\.html?$/i.test(p) && st.size < 200_000);
  const scored = pages.map((p) => {
    const rel = relative(root, p).split(sep).join('/');
    let html = '';
    try { html = readFileSync(p, 'utf8'); } catch { /* unreadable */ }
    const game = /<canvas|phaser|getContext|<script[^>]+src=/i.test(html);
    const score = (rel.toLowerCase() === 'index.html' ? 100 : 0) + (/index\.html?$/i.test(rel) ? 20 : 0)
      - rel.split('/').length * 5 - (/node_modules|docs?\/|test/i.test(rel) ? 50 : 0);
    return { rel, game, score };
  });
  return scored.filter((x) => x.game).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.rel);
}

function serve(root) {
  const srv = createServer((req, res) => {
    let rel;
    // A malformed escape (create-react-app templates ship '%PUBLIC_URL%' in index.html) made
    // decodeURIComponent throw inside the handler and crashed the whole process: answer 400.
    try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const p = resolve(root, '.' + rel);
    if (!p.startsWith(resolve(root))) { res.writeHead(403); return res.end(); }
    try {
      const body = readFileSync(p);
      res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/** Boot one page: errors, and whether its biggest canvas is drawn and animating (from screenshots). */
async function boot(browser, base, rel) {
  const page = await browser.newPage();
  const errors = [];
  const missing = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).split('\n')[0].slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) missing.push(r.url().slice(base.length)); });
  // alert()/confirm()/prompt() blocks the page and every later screenshot waits on it forever,
  // so it is dismissed. It is NOT an error: a snake that starts moving by itself hits a wall
  // inside the boot window and shows its normal "Game Over" alert - rejecting that rejected a
  // working game. Recorded separately so goal checks know the game uses dialogs.
  page.on('dialog', (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 60)}`); d.dismiss().catch(() => {}); });
  // A page that leaves the local server cannot be a workspace: mumuy/pacman has a domain lock
  // (hostname is not passer-by.com -> location.href = 'https://passer-by.com/') that fires a
  // few seconds after load. Counted as an error, so such a game is never kept.
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && !f.url().startsWith(base)) errors.push('navigated away to ' + f.url().slice(0, 80)); });
  try {
    await page.setViewport({ width: 1024, height: 768 });
    await serveScriptsFromCache(page, { onFailure: (u) => errors.push('engine script unavailable: ' + u) });
    await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 15000 });
    await sleep(1500);
    const handle = await page.evaluateHandle(() => {
      const cs = [...document.querySelectorAll('canvas')].filter((c) => c.clientWidth > 0 && c.clientHeight > 0);
      cs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
      return cs[0] || null;
    });
    const canvas = handle.asElement();
    if (!canvas) return { rel, errors, missing, dialogs, canvas: false };
    const size = await page.evaluate((c) => ({ w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight }), canvas);
    const shot1 = await canvas.screenshot({ type: 'png' });
    await sleep(700);
    const shot2 = await canvas.screenshot({ type: 'png' });
    await sleep(2000);   // late redirects (domain locks) fire a few seconds after load - catch them before the verdict
    // A flat single-colour canvas compresses to almost nothing; anything drawn does not.
    const bytesPerKpx = (shot1.length / Math.max(1, size.cssW * size.cssH)) * 1000;
    return { rel, errors, missing, dialogs, canvas: true, size, drawn: bytesPerKpx > 8, animated: !shot1.equals(shot2), shotBytes: shot1.length };
  } catch (e) {
    errors.push('load: ' + String(e.message || e).split('\n')[0].slice(0, 120));
    return { rel, errors, missing, dialogs, canvas: false };
  } finally {
    await Promise.race([page.close().catch(() => {}), sleep(5000)]);
  }
}

/**
 * One repo: clone, find its game pages, boot them, keep the first that boots cleanly.
 * Returns the manifest row (and a one-line summary for the log). The workspace, when kept,
 * is copied to DEST/<slug> - without .git and node_modules, with its LICENSE file.
 */
async function harvestRepo(browser, repo) {
  const slug = repo.name.replace(/[^\w.-]/g, '__');
  const clone = join(WORK, slug);
  const row = { repo: repo.name, license: repo.license, stars: repo.stars, mb: repo.mb, harvestedAt: new Date().toISOString() };
  try { rmSync(clone, { recursive: true, force: true }); } catch { /* fresh */ }
  try {
    execFileSync('git', ['-c', 'core.longpaths=true', 'clone', '--depth', '1', '--quiet', '--no-tags',
      `https://github.com/${repo.name}.git`, clone], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180_000 });
    row.sha = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD']).toString().trim();
  } catch {
    return { row: { ...row, status: 'clone-failed' }, line: `  ! ${repo.name}: clone failed` };
  }
  try {
    const pages = candidatePages(clone);
    if (!pages.length) return { row: { ...row, status: 'no-game-page' }, line: `  - ${repo.name}: no html game page` };

    const srv = await serve(clone);
    const base = `http://127.0.0.1:${srv.address().port}`;
    const tries = [];
    let kept = null;
    for (const rel of pages) {
      // A hard ceiling per page: one hung page must not stall a run.
      const b = await Promise.race([boot(browser, base, rel),
        sleep(45000).then(() => ({ rel, errors: ['boot timed out after 45s'], missing: [], dialogs: [], canvas: false }))]);
      tries.push({ rel: b.rel, errors: b.errors.slice(0, 3), missing: b.missing.slice(0, 3), canvas: b.canvas, drawn: b.drawn, animated: b.animated });
      if (b.canvas && b.drawn && b.errors.length === 0) { kept = b; break; }
    }
    srv.closeAllConnections?.(); await Promise.race([new Promise((r) => srv.close(r)), sleep(3000)]);  /* a held-open connection must not hang the close */

    if (!kept) {
      // The REASON a page was rejected: an error, else no canvas / blank canvas. A 404 (favicon,
      // manifest) never rejects a page by itself - it is shown only as context.
      const why = tries.map((t) => `${t.rel}: ${t.errors[0] || (!t.canvas ? 'no canvas' : !t.drawn ? 'canvas blank' : '?')}`
        + (t.missing[0] ? ` (404 ${t.missing[0]})` : '')).join(' | ');
      return { row: { ...row, status: 'not-bootable', tries }, line: `  x ${repo.name}: ${why.slice(0, 150)}` };
    }

    const ws = join(DEST, slug);
    rmSync(ws, { recursive: true, force: true });
    mkdirSync(DEST, { recursive: true });
    cpSync(clone, ws, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
    const licenceFiles = readdirSync(ws).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f));
    const jsFiles = walk(ws, (p) => /\.(m?js|ts)$/i.test(p) && !/\.min\.js$/i.test(p)).map((p) => relative(ws, p).split(sep).join('/'));
    return {
      row: { ...row, status: 'kept', dir: 'raw/workspaces/' + slug, entry: kept.rel, animated: kept.animated,
        dialogs: kept.dialogs || [], canvas: kept.size, bytes: dirBytes(ws), licenceFiles, jsFiles: jsFiles.slice(0, 40), jsCount: jsFiles.length },
      line: `  + ${repo.name} [${repo.license}] ${kept.rel} ${kept.size.w}x${kept.size.h} ${kept.animated ? 'animated' : 'static'} | ${jsFiles.length} js | licence file: ${licenceFiles[0] || 'NONE'}`,
    };
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
}

// ── one repo (a container's job) ──────────────────────────────────────────────────────
mkdirSync(WORK, { recursive: true });
if (ONE) {
  const repo = { name: ONE, license: flag('license', ''), stars: Number(flag('stars', 0)), mb: Number(flag('mb', 0)) };
  const browser = await puppeteer.launch(launchOptions());
  let r;
  try { r = await harvestRepo(browser, repo); }
  catch (e) { r = { row: { repo: ONE, license: repo.license, stars: repo.stars, mb: repo.mb, status: 'error', error: String(e.message || e).slice(0, 200) }, line: `  ! ${ONE}: ${String(e.message || e).slice(0, 100)}` }; }
  await browser.close().catch(() => {});
  console.error(r.line);
  console.log('ROW ' + JSON.stringify(r.row));
  process.exit(0);
}

// ── a batch (the laptop path) ─────────────────────────────────────────────────────────
const { permissive } = JSON.parse(readFileSync(REPOS, 'utf8'));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).repo) : []);
const pool = permissive.filter((r) => r.mb <= MAX_MB);
const batch = pool.slice(OFFSET, OFFSET + LIMIT).filter((r) => !done.has(r.name));
mkdirSync(DEST, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });
console.log(`${pool.length} permissive repos <= ${MAX_MB} MB; this batch: ${batch.length} (offset ${OFFSET}, limit ${LIMIT}, ${done.size} already in the manifest)`);

const browser = await puppeteer.launch(launchOptions());
const stats = { tried: 0, 'clone-failed': 0, 'no-game-page': 0, 'not-bootable': 0, kept: 0, animated: 0, error: 0 };
const t0 = Date.now();
for (const repo of batch) {
  stats.tried++;
  let r;
  try { r = await harvestRepo(browser, repo); }
  catch (e) { r = { row: { repo: repo.name, license: repo.license, stars: repo.stars, mb: repo.mb, status: 'error', error: String(e.message || e).slice(0, 200) }, line: `  ! ${repo.name}: ${String(e.message || e).slice(0, 100)}` }; }
  stats[r.row.status] = (stats[r.row.status] || 0) + 1;
  if (r.row.status === 'kept' && r.row.animated) stats.animated++;
  appendFileSync(OUT, JSON.stringify(r.row) + '\n');
  console.log(r.line);
}
await browser.close();
const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\ntried ${stats.tried} | kept ${stats.kept} (${stats.animated} animated) | not bootable ${stats['not-bootable']} | no game page ${stats['no-game-page']} | clone failed ${stats['clone-failed']} | errors ${stats.error} | ${mins} min`);
