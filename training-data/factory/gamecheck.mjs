/**
 * gamecheck.mjs - "edit an EXISTING game" goals, and black-box checkers that grade them.
 *
 *   node factory/gamecheck.mjs validate [--limit N]
 *       for every kept workspace (raw/workspaces_manifest.jsonl) and every goal: the checker
 *       must FAIL on the untouched game and PASS on a generic reference edit. Only goals that
 *       do both count for that game - that is the proof the checker measures the goal, not luck.
 *       Writes raw/game_goals.jsonl: one row per (workspace, goal) that passed validation.
 *   node factory/gamecheck.mjs check <workspaceDir> <entry.html> <goalId>
 *       grades a workspace (e.g. after a model edited a copy of it). Prints a JSON verdict.
 *
 * WHY BLACK-BOX
 * -------------
 * Harvested games share nothing: one has requestAnimationFrame in 8 places, one drives an AI
 * from setInterval, one is WebGL. A checker that reads the code would need a parser per engine.
 * These load the page in the hub's own browser setup (CDN scripts from the engine cache) and
 * judge what HAPPENS: canvas screenshots frozen or moving, elements present and visible,
 * values in window. Every check also demands zero page errors and a canvas that still draws -
 * "the new feature works but the game is broken" is a fail, which is the 14B's actual failure.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, cpSync } from 'fs';
import { join, extname, resolve, dirname, relative, sep } from 'path';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, '..', '..', 'server');
const require = createRequire(join(SERVER, 'index.js'));
const puppeteer = require('puppeteer');
const { launchOptions } = await import(pathToFileURL(join(SERVER, 'browser.js')).href);
const { serveScriptsFromCache } = await import(pathToFileURL(join(SERVER, 'engineCache.js')).href);

const MIME = { '.html': 'text/html', '.htm': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root) {
  const srv = createServer((req, res) => {
    let rel;
    // A malformed escape (create-react-app templates ship '%PUBLIC_URL%' in index.html) made
    // decodeURIComponent throw inside the handler and crashed the whole process: answer 400.
    try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const p = resolve(root, '.' + rel);
    if (!p.startsWith(resolve(root))) { res.writeHead(403); return res.end(); }
    try { const body = readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/** Open the entry page. Returns helpers bound to it; the caller closes it. */
async function open(browser, base, entry) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).split('\n')[0].slice(0, 160)));
  // An alert()/confirm()/prompt() blocks the page, and every later evaluate or screenshot
  // waits on it forever - a validation run hung on one. Dismissed, but NOT counted as an
  // error: a game-over alert() firing while the check plays the game is the game working.
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  // A page that leaves the local server is not a game we can grade. mumuy/pacman carries a
  // domain lock (if hostname is not passer-by.com, location.href = 'https://passer-by.com/')
  // that fires seconds after load and destroyed the page mid-check.
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && !f.url().startsWith(base)) errors.push('navigated away to ' + f.url().slice(0, 80)); });
  await page.setViewport({ width: 1024, height: 768 });
  await serveScriptsFromCache(page, { onFailure: (u) => errors.push('engine script unavailable: ' + u) });
  await page.goto(base + '/' + entry, { waitUntil: 'load', timeout: 15000 });
  await sleep(1500);
  const shot = async () => {
    const h = await page.evaluateHandle(() => {
      const cs = [...document.querySelectorAll('canvas')].filter((c) => c.clientWidth > 0 && c.clientHeight > 0);
      cs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
      return cs[0] || null;
    });
    const el = h.asElement();
    return el ? el.screenshot({ type: 'png' }) : null;
  };
  const moving = async (gap = 700) => { const a = await shot(); await sleep(gap); const b = await shot(); return !!(a && b && !a.equals(b)); };
  const drawn = async () => {
    const a = await shot();
    if (!a) return false;
    const px = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((x, y) => y.clientWidth * y.clientHeight - x.clientWidth * x.clientHeight)[0]; return c ? c.clientWidth * c.clientHeight : 1; });
    return (a.length / Math.max(1, px)) * 1000 > 8;
  };
  // WAKE: many games sit on a title screen until a click or a key (spacepi, pixelator,
  // achtung-die-kurve), so pause / fps / frames could never validate on them - nothing runs yet.
  // If the canvas is not moving, click its centre and press Enter and Space, then judge. This
  // happens identically on the untouched game and on the reference, so fail -> pass still holds.
  if (!(await moving(500))) {
    try {
      const box = await page.evaluate(() => {
        const c = [...document.querySelectorAll("canvas")].sort((x, y) => y.clientWidth * y.clientHeight - x.clientWidth * x.clientHeight)[0];
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (box) await page.mouse.click(box.x, box.y);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      await sleep(600);
    } catch { /* a page that cannot be woken is judged as it is */ }
  }
  return { page, errors, shot, moving, drawn };
}

// ── controls the game really handles (for the help goal) ──────────────────────────────
function controlsIn(wsDir, jsFiles) {
  let src = '';
  for (const f of jsFiles.slice(0, 40)) { try { src += readFileSync(join(wsDir, f), 'utf8') + '\n'; } catch { /* gone */ } }
  try { src += readFileSync(join(wsDir, 'index.html'), 'utf8'); } catch { /* none */ }
  const found = new Set();
  if (/Arrow(Up|Down|Left|Right)|keyCode\s*[=!]==?\s*(37|38|39|40)\b|\b(37|38|39|40)\s*:/.test(src)) found.add('arrow keys');
  if (/['"](Space|Spacebar| )['"]|keyCode\s*[=!]==?\s*32\b/.test(src)) found.add('space');
  if (/['"]Enter['"]|keyCode\s*[=!]==?\s*13\b/.test(src)) found.add('enter');
  if (/['"](Key)?[wW]['"]|['"](Key)?[sS]['"]|keyCode\s*[=!]==?\s*(87|65|83|68)\b/.test(src) && /['"](Key)?[aA]['"]|['"](Key)?[dD]['"]|\b(65|68)\b/.test(src)) found.add('WASD');
  if (/['"](click|mousedown|mouseup|pointerdown)['"]|onclick|onmousedown/.test(src)) found.add('mouse');
  if (/['"](touchstart|touchend)['"]/.test(src)) found.add('touch');
  return [...found];
}
const CONTROL_WORDS = { 'arrow keys': /arrow|←|→|↑|↓/i, space: /space/i, enter: /enter|return/i, WASD: /\bw\b.*\ba\b.*\bs\b.*\bd\b|wasd/i, mouse: /mouse|click/i, touch: /touch|tap/i };

// ── the goals ──────────────────────────────────────────────────────────────────────────
// Each: text for the model, a black-box check, and a generic REFERENCE edit used only to prove
// the check can pass. References are injected as a <script> at the very top of <head>, so a
// requestAnimationFrame wrapper is in place before the game's own code runs.
const GOALS = {
  pause: {
    text: (m) => `In the EXISTING game in this workspace (it starts from ${m.entry}), add a pause key: pressing P freezes the game completely, and pressing P again resumes it. Keep everything else working exactly as before.`,
    async check(o) {
      if (!(await o.moving())) return { pass: false, why: 'game is not animating before pause was pressed' };
      await o.page.keyboard.press('p'); await sleep(300);
      const frozen = !(await o.moving());
      await o.page.keyboard.press('p'); await sleep(300);
      const resumed = await o.moving();
      return { pass: frozen && resumed, why: `frozen after P: ${frozen}; moving again after second P: ${resumed}` };
    },
    ref: () => `(function(){var paused=false,q=[],raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=function(cb){if(paused){q.push(cb);return 0;}return raf(cb);};
addEventListener('keydown',function(e){if(e.key==='p'||e.key==='P'){paused=!paused;if(!paused){q.splice(0).forEach(function(cb){raf(cb);});}}},true);})();`,
  },
  fps: {
    text: (m) => `In the EXISTING game in this workspace (it starts from ${m.entry}), show the current frames per second in an element with id "fps", fixed in the top-left corner of the page and updated at least once a second. Do not break the game.`,
    async check(o) {
      await sleep(1200);
      const read = () => o.page.evaluate(() => { const e = document.getElementById('fps'); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { text: e.textContent || '', visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', top: r.top, left: r.left }; });
      let a = await read();
      if (!a) return { pass: false, why: 'no element with id "fps"' };
      const num = (x) => parseFloat((((x && x.text) || '').match(/\d+(\.\d+)?/) || [])[0]);
      // Read twice before failing: a counter that updates once a second may not have ticked at the
      // first read. (Every pilot fps failure showed "0 FPS"; this rules out a timing race.)
      if (!(num(a) >= 5)) { await sleep(1300); const b = await read(); if (b && num(b) > (num(a) || 0)) a = b; }
      const n = num(a);
      const topLeft = a.top < 120 && a.left < 200;
      const ok = a.visible && topLeft && n >= 5 && n <= 240;
      return { pass: ok, why: `#fps "${a.text.trim().slice(0, 20)}" visible:${a.visible} top-left:${topLeft} value:${n}` };
    },
    ref: () => `(function(){var n=0,raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=function(cb){return raf(function(t){n++;cb(t);});};
function mk(){var d=document.createElement('div');d.id='fps';d.style.cssText='position:fixed;top:4px;left:4px;z-index:99999;color:#fff;background:#000;font:12px monospace;padding:2px';d.textContent='FPS: 0';document.body.appendChild(d);
setInterval(function(){d.textContent='FPS: '+n*2;n=0;},500);}
if(document.body)mk();else addEventListener('DOMContentLoaded',mk);})();`,
  },
  frames: {
    text: (m) => `In the EXISTING game in this workspace (it starts from ${m.entry}), count every frame the game's own loop draws in a global variable window.frameCount: start it at 0 and add 1 each time the game loop runs. Do not change how the game plays.`,
    async check(o) {
      const a = await o.page.evaluate(() => window.frameCount);
      await sleep(1000);
      const b = await o.page.evaluate(() => window.frameCount);
      const d = (typeof a === 'number' && typeof b === 'number') ? b - a : NaN;
      return { pass: d >= 10 && d <= 300, why: `window.frameCount ${a} -> ${b} in 1s (delta ${d})` };
    },
    ref: () => `(function(){window.frameCount=0;var raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=function(cb){return raf(function(t){window.frameCount++;cb(t);});};})();`,
  },
  help: {
    applies: (m) => m.controls.length > 0,
    text: (m) => `In the EXISTING game in this workspace (it starts from ${m.entry}), add a button with id "help" that shows and hides a panel with id "helpPanel". The panel must list the game's REAL controls - read the code to find which keys or mouse actions it actually handles. Do not break the game.`,
    async check(o, m) {
      const vis = () => o.page.evaluate(() => { const e = document.getElementById('helpPanel'); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; });
      const has = await o.page.evaluate(() => !!document.getElementById('help'));
      if (!has) return { pass: false, why: 'no element with id "help"' };
      const v0 = await vis();
      await o.page.evaluate(() => document.getElementById('help').click()); await sleep(200);
      const v1 = await vis();
      const text = await o.page.evaluate(() => (document.getElementById('helpPanel') || {}).textContent || '');
      await o.page.evaluate(() => document.getElementById('help').click()); await sleep(200);
      const v2 = await vis();
      const named = m.controls.filter((c) => CONTROL_WORDS[c].test(text));
      const ok = !v0 && v1 === true && !v2 && named.length > 0;
      return { pass: ok, why: `hidden:${!v0} shown-on-click:${v1} hidden-again:${!v2} real controls named: ${named.join(', ') || 'none'} (game handles: ${m.controls.join(', ')}) | panel text: "${text.trim().replace(/\s+/g, ' ').slice(0, 80)}"` };
    },
    ref: (m) => `(function(){function mk(){var b=document.createElement('button');b.id='help';b.textContent='Help';b.style.cssText='position:fixed;top:4px;right:4px;z-index:99999';
var p=document.createElement('div');p.id='helpPanel';p.style.cssText='display:none;position:fixed;top:30px;right:4px;z-index:99999;background:#fff;color:#000;padding:6px';
p.textContent='Controls: ${m.controls.join(', ')}';b.onclick=function(){p.style.display=p.style.display==='none'?'block':'none';};
document.body.appendChild(b);document.body.appendChild(p);}
if(document.body)mk();else addEventListener('DOMContentLoaded',mk);})();`,
  },
  bg: {
    text: (m) => `In the EXISTING game in this workspace (it starts from ${m.entry}), change the page background colour around the game to #001133. Do not change anything else.`,
    async check(o) {
      // The page's EFFECTIVE background: <body> if it paints one, else <html>. Setting the colour on
      // <html> looks identical on screen; the pilot failed 4 such runs on a transparent <body>.
      const c = await o.page.evaluate(() => {
        const clear = (x) => !x || x === 'rgba(0, 0, 0, 0)' || x === 'transparent';
        const b = getComputedStyle(document.body).backgroundColor;
        return clear(b) ? getComputedStyle(document.documentElement).backgroundColor : b;
      });
      return { pass: c === 'rgb(0, 17, 51)', why: `page background ${c}` };
    },
    ref: () => `(function(){var s=document.createElement('style');s.textContent='html,body{background:#001133 !important}';document.head.appendChild(s);})();`,
  },
};

/** Grade one goal on one served workspace. Every goal also needs: no page errors, canvas still drawn. */
async function grade(browser, dir, entry, goalId, meta) {
  const srv = await serve(dir);
  const base = `http://127.0.0.1:${srv.address().port}`;
  let o;
  try {
    // Hard ceilings: one hung page must not stall a validation run (it did, before these).
    const cap = (p, ms, v) => Promise.race([p, sleep(ms).then(() => v)]);
    o = await cap(open(browser, base, entry), 30000, null);
    if (!o) return { pass: false, why: 'page did not open within 30s' };
    const g = await cap(GOALS[goalId].check(o, meta), 40000, { pass: false, why: 'check timed out after 40s' });
    const drawn = await cap(o.drawn(), 15000, false);
    const pass = g.pass && o.errors.length === 0 && drawn;
    const why = [g.why, o.errors.length ? `page errors: ${o.errors[0]}` : '', drawn ? '' : 'canvas no longer draws'].filter(Boolean).join(' | ');
    return { pass, why };
  } catch (e) {
    return { pass: false, why: 'load: ' + String(e.message || e).split('\n')[0].slice(0, 120) };
  } finally {
    if (o) await Promise.race([o.page.close().catch(() => {}), sleep(5000)]);
    srv.closeAllConnections?.(); await Promise.race([new Promise((r) => srv.close(r)), sleep(3000)]);  /* a held-open connection must not hang the close */
  }
}

function withReference(wsDir, entry, goalId, meta) {
  const tmp = join(tmpdir(), 'gamecheck-ref', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  cpSync(wsDir, tmp, { recursive: true });
  writeFileSync(join(tmp, `__ref_${goalId}.js`), GOALS[goalId].ref(meta));
  const p = join(tmp, entry);
  let html = readFileSync(p, 'utf8');
  const tag = `<script src="/__ref_${goalId}.js"></script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
  writeFileSync(p, html);
  return tmp;
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────
const [mode, ...rest] = process.argv.slice(2);
const MANIFEST = join(HERE, 'raw', 'workspaces_manifest.jsonl');
const GOALS_OUT = join(HERE, 'raw', 'game_goals.jsonl');

if (mode === 'check') {
  const [dir, entry, goalId] = rest;
  const jsFiles = [];
  // Dangling symlinks are skipped: the pilot's grader died on one (ENOENT stat .../engine.d.ts).
  (function walk(d) { for (const e of readdirSync(d)) { if (e === 'node_modules' || e === '.git') continue; const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) walk(p); else if (/\.m?js$/i.test(e)) jsFiles.push(relative(dir, p).split(sep).join('/')); } })(dir);
  const browser = await puppeteer.launch(launchOptions());
  // Always answer: one pilot check ran past 180 s and returned no verdict at all.
  const v = await Promise.race([grade(browser, dir, entry, goalId, { entry, controls: controlsIn(dir, jsFiles) }),
    sleep(150000).then(() => ({ pass: false, why: 'check timed out after 150s' }))]);
  await Promise.race([browser.close().catch(() => {}), sleep(5000)]);
  console.log(JSON.stringify(v));
  process.exit(v.pass ? 0 : 1);
}

if (mode === 'validate') {
  const limit = rest.includes('--limit') ? Number(rest[rest.indexOf('--limit') + 1]) : Infinity;
  const kept = readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.status === 'kept').slice(0, limit);
  const browser = await puppeteer.launch(launchOptions());
  const rows = [];
  const tally = Object.fromEntries(Object.keys(GOALS).map((g) => [g, { valid: 0, origPassed: 0, refFailed: 0, na: 0 }]));
  for (const k of kept) {
    const wsDir = join(HERE, k.dir);
    const meta = { entry: k.entry, controls: controlsIn(wsDir, k.jsFiles || []) };
    const line = [];
    // STAYS PUT: load the untouched game and watch it for 6s. A domain-locked page that jumps to
    // its author's site a few seconds in makes every later grade a coin toss, so the whole game
    // is dropped - not just the goal whose check happened to be running when it left.
    const away = await (async () => {
      const srv = await serve(wsDir);
      const base = 'http://127.0.0.1:' + srv.address().port;
      let o = null;
      try { o = await open(browser, base, k.entry); await sleep(6000); return o.errors.find((e) => e.startsWith('navigated away')) || null; }
      catch { return null; }
      finally { if (o) await Promise.race([o.page.close().catch(() => {}), sleep(5000)]); srv.closeAllConnections?.(); await Promise.race([new Promise((r) => srv.close(r)), sleep(3000)]);  /* a held-open connection must not hang the close */ }
    })();
    if (away) { console.log(k.repo.padEnd(42) + ' UNSUITABLE: ' + away); continue; }
    for (const [id, g] of Object.entries(GOALS)) {
      if (g.applies && !g.applies(meta)) { tally[id].na++; line.push(`${id}:n/a`); continue; }
      const orig = await grade(browser, wsDir, k.entry, id, meta);
      if (orig.pass) { tally[id].origPassed++; line.push(`${id}:ALREADY`); continue; }
      const tmp = withReference(wsDir, k.entry, id, meta);
      const ref = await grade(browser, tmp, k.entry, id, meta);
      rmSync(tmp, { recursive: true, force: true });
      if (!ref.pass) { tally[id].refFailed++; line.push(`${id}:refFAIL(${ref.why.slice(0, 50)})`); continue; }
      tally[id].valid++; line.push(`${id}:ok`);
      rows.push({ repo: k.repo, license: k.license, sha: k.sha, dir: k.dir, entry: k.entry, goal: id, text: g.text(meta), controls: meta.controls, origWhy: orig.why });
    }
    console.log(`${k.repo.padEnd(42)} ${line.join('  ')}`);
  }
  await browser.close();
  mkdirSync(dirname(GOALS_OUT), { recursive: true });
  writeFileSync(GOALS_OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  console.log('\nper goal (valid = fails on the original AND passes on the reference):');
  for (const [id, t] of Object.entries(tally)) console.log(`  ${id.padEnd(7)} valid ${t.valid} | already true ${t.origPassed} | reference could not pass ${t.refFailed} | not applicable ${t.na}`);
  console.log(`\n${rows.length} validated goals from ${kept.length} games -> ${GOALS_OUT}`);
  process.exit(0);
}

if (mode === 'gate') {
  // THE HUB'S OWN FINISH GATE, MIRRORED. The hub inspects /workspace/index.html (hard-coded) with
  // visualCheck and refuses to finish while hasProblems() is true. A harvested game that trips it
  // UNTOUCHED - a spare blank canvas, a collapsed element, no root index.html, or root-absolute
  // paths ('/js/game.js') that break once the game lives under /workspace/ - forces every run on
  // it into three gate blocks and a forced finish: junk training data. A mock run on snake.io did
  // exactly that (its third, blank canvas). So each kept game is served the way the hub serves a
  // workspace (only /workspace/ is the game) and judged by the hub's own inspect + hasProblems.
  const visual = await import(pathToFileURL(join(SERVER, 'visualCheck.js')).href);
  const limit = rest.includes('--limit') ? Number(rest[rest.indexOf('--limit') + 1]) : Infinity;
  const kept = readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.status === 'kept').slice(0, limit);
  const OUTG = join(HERE, 'raw', 'gate_check.jsonl');
  const rows = [];
  let clean = 0;
  for (const k of kept) {
    const wsDir = join(HERE, k.dir);
    let why = '';
    if (!existsSync(wsDir)) why = 'workspace not on disk';
    else if (!existsSync(join(wsDir, 'index.html'))) why = 'no root index.html (the hub gate always inspects /workspace/index.html)';
    else {
      const srv = createServer((req, res) => {
        let rel;
        try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
        if (!rel.startsWith('/workspace/')) { res.writeHead(404); return res.end(); }   // as in the hub: only /workspace/ is the game
        rel = rel.slice('/workspace'.length);
        if (rel.endsWith('/')) rel += 'index.html';
        const p = resolve(wsDir, '.' + rel);
        if (!p.startsWith(resolve(wsDir))) { res.writeHead(403); return res.end(); }
        try { const body = readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' }); res.end(body); }
        catch { res.writeHead(404); res.end(); }
      });
      await new Promise((r) => srv.listen(0, '127.0.0.1', r));
      const url = 'http://127.0.0.1:' + srv.address().port + '/workspace/index.html';
      const r = await Promise.race([visual.inspect(url, { settleMs: 1200 }), sleep(45000).then(() => null)]);
      srv.closeAllConnections?.();
      await Promise.race([new Promise((x) => srv.close(x)), sleep(3000)]);
      if (!r) why = 'inspect timed out';
      else if (!r.ok) why = String(r.report || '').slice(0, 140);
      else if (visual.hasProblems(r)) why = String(r.report || '').split('\n').filter((l) => /^\s+\d+\./.test(l)).map((l) => l.trim()).join(' ').slice(0, 220);
    }
    if (!why) clean++;
    rows.push({ repo: k.repo, dir: k.dir, entry: k.entry, gateClean: !why, why });
    console.log((why ? 'TRIPS ' : 'clean ') + k.repo.padEnd(44) + ' ' + why.slice(0, 120));
  }
  writeFileSync(OUTG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log('\n' + clean + ' of ' + rows.length + ' kept games pass the hub finish gate untouched -> ' + OUTG);
  process.exit(0);
}

console.error('usage: node factory/gamecheck.mjs validate [--limit N] | gate [--limit N] | check <dir> <entry> <goalId>');
process.exit(2);
