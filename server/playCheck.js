/**
 * playCheck.js - a DECLARED play of a browser game, run in headless Chrome, judged step by step.
 *
 * The check the model did not write. A spec lists steps - load the page, press keys, wait,
 * evaluate an expression against the page - and each step's expectation is a case: PASS or
 * FAIL, like the QuixBugs cases. The game exposes its state through a contract the request
 * names (by default `window.game.state()`); the spec reads that contract and nothing else.
 *
 *   spec = {
 *     entry: 'index.html',
 *     stateExpr: 'window.game && window.game.state()',      // how state is observed
 *     steps: [
 *       { n: 1, name: 'loads without errors', do: [], expect: 'noErrors' },
 *       { n: 2, name: 'move right', do: [{ key: 'ArrowRight', times: 3 }], expect: 'state.player.x > before.player.x' },
 *       ...
 *     ],
 *     settleMs: 120,
 *   }
 *
 * `expect` is a JS expression evaluated IN NODE over { state, before, errors, storage, url } -
 * `state` is the observed state after the step, `before` the state before it, `errors` the
 * page/console errors so far, `storage` a snapshot of localStorage. 'noErrors' is the one
 * named expectation. Steps run in order; a failing step does not stop the play (later steps
 * may still pass or fail on their own), but a step that throws is an ERROR case.
 *
 * Output mirrors the case runner: one line per case, then `SUMMARY p/t cases pass, f fail`, so
 * the same parsing (caseSet, autodiag) applies. Returns { passing, failing, total, cases, log }.
 *
 * The browser is the one installed on this machine (Chrome/Edge) driven through puppeteer-core;
 * no browser is downloaded. The candidate directory is served read-only from a temporary
 * local static server that exists only for the play.
 */
import { perform as performAction, readDom, UnsupportedAction } from './actions.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

export const BROWSER_CANDIDATES = [
  process.env.PLAYCHECK_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
export function findBrowser() { return BROWSER_CANDIDATES.find((p) => { try { return existsSync(p); } catch { return false; } }) || null; }

function serveDir(dirIn) {
  // RESOLVE FIRST. `join` normalises separators (on Windows to backslashes), so comparing the
  // joined path against an unresolved caller string containing forward slashes made
  // `startsWith` false for every request and served 404 for a file that was right there. A
  // caller that passed a forward-slash directory got a page that never loaded and a play that
  // blamed the candidate. Both halves of the comparison are now resolved.
  const dir = resolve(dirIn);
  return new Promise((resolve_) => {
    const srv = createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const safe = normalize(rel).replace(/^([.][.][\\/])+/, '');
      let file = resolve(join(dir, safe === '/' || safe === '\\' ? 'index.html' : safe));
      try {
        if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(readFileSync(file));
      } catch { res.writeHead(500); res.end('error'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve_({ srv, port: srv.address().port }));
  });
}

function evaluateExpectation(expr, env) {
  if (expr === 'noErrors') return env.errors.length === 0;
  // A small, explicit evaluation scope: no access to node globals beyond what is passed.
  //
  // `dom` is the page as a user sees it: { visible, hidden, inputValues, visibleCount }. It exists so a
  // check can state the DOWNSTREAM result - which rows are on screen - rather than reading a state seam
  // a page may have no reason to expose. `inputValues` is kept apart from `visible` because typing
  // changes an input's own value whether or not the application reacts.
  const fn = new Function('state', 'before', 'errors', 'storage', 'url', 'dom', 'domBefore', `return (${expr});`);
  return !!fn(env.state, env.before, env.errors, env.storage, env.url, env.dom, env.domBefore);
}

export async function playCheck(candidateDir, spec, { timeoutMs = 60_000, browserPath = null } = {}) {
  const exe = browserPath || findBrowser();
  if (!exe) return { status: 'UNAVAILABLE', reason: 'no Chrome/Edge executable found (PLAYCHECK_BROWSER unset)', passing: new Set(), failing: new Set(), total: null, cases: [], log: '' };
  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch { return { status: 'UNAVAILABLE', reason: 'puppeteer-core is not installed', passing: new Set(), failing: new Set(), total: null, cases: [], log: '' }; }

  const { srv, port } = await serveDir(candidateDir);
  const url = `http://127.0.0.1:${port}/${spec.entry || 'index.html'}`;
  const errors = [];
  const stacks = [];
  // WHY THIS EXISTS. REPAIR-2: fed only "Cannot read properties of null (reading
  // 'addEventListener')", the model applied the textbook fix for an element that is not there YET
  // (defer to DOMContentLoaded) when the element is not there AT ALL. The message cannot tell those
  // apart. These three facts narrow it, and all three are read off the page rather than reasoned
  // about: which ids were looked up and came back null, which ids the document actually has at that
  // moment, and which it has once it is ready. An absent id at readyState complete rules out
  // "readiness will create it" in the state observed - not a later dynamic insertion by some other
  // script, so this narrows the question rather than settling it.
  let dom = { nullLookups: [], idsAtFirstFailure: null, idsAfterReady: null };
  const cases = [];
  const lines = [];
  let browser = null;
  const deadline = Date.now() + timeoutMs;
  try {
    // The Hub's own resolution (browser.js: explicit path, bundled, puppeteer cache, installed
    // Chrome/Edge) unless a path was given - the same Chromium test_web drives.
    let base = {};
    try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back to the found executable */ }
    browser = await puppeteer.launch({ ...base, executablePath: browserPath || base.executablePath || exe, headless: true, args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage'], timeout: 20_000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    // A favicon 404 surfaces as a console.error "Failed to load resource" on every page; the
    // HTTP filter below already names real 4xx/5xx on the page's own files. Same rule as test_web.
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(`[console.error] ${m.text()}`.slice(0, 300)); });
    page.on('pageerror', (e) => {
      errors.push(`[JS ERROR] ${String(e.message || e)}`.slice(0, 300));
      // The stack names the line; the message alone does not.
      if (e && e.stack) stacks.push(String(e.stack).split('\n').slice(0, 4).join('\n').slice(0, 600));
    });
    page.on('response', (r) => { if (r.status() >= 400 && !/favicon/i.test(r.url())) errors.push(`[HTTP ${r.status()}] ${r.url().split('/').pop()}`); });
    const settle = spec.settleMs ?? 120;
    const readState = async () => {
      try { return await page.evaluate(`(function(){ try { const s = (${spec.stateExpr || 'window.game && window.game.state()'}); return s === undefined ? null : JSON.parse(JSON.stringify(s)); } catch (e) { return { __error: String(e && e.message || e) }; } })()`); }
      catch (e) { return { __error: String(e.message || e) }; }
    };
    const readStorage = async () => { try { return await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }); } catch { return {}; } };

    // THE ENTRY PAGE MUST ACTUALLY BE SERVED. A 404 or 5xx here says nothing about the
    // candidate's behaviour - it says the play could not run. Reporting it as failing steps
    // would blame generated code for the harness's own inability to serve the file.
    // Record every getElementById that returns null, without changing what it returns.
    await page.evaluateOnNewDocument(() => {
      window.__nullLookups = [];
      const orig = document.getElementById.bind(document);
      document.getElementById = function (id) {
        const el = orig(id);
        if (!el) {
          window.__nullLookups.push({ id: String(id), ids: Array.from(document.querySelectorAll('[id]')).map((n) => n.id) });
        }
        return el;
      };
    });

    const nav = await page.goto(url, { waitUntil: 'load', timeout: 15_000 });
    const navStatus = nav ? nav.status() : 0;
    if (!nav || navStatus >= 400) {
      throw new Error(`the entry page ${spec.entry || 'index.html'} could not be served (HTTP ${navStatus || 'no response'})`);
    }
    await new Promise((r) => setTimeout(r, spec.loadSettleMs ?? 400));

    for (const step of spec.steps || []) {
      if (Date.now() > deadline) { cases.push({ n: step.n, name: step.name, kind: 'ERROR', text: 'play timed out before this step' }); lines.push(`ERROR case ${step.n}  ${step.name}: play timed out`); continue; }
      const before = await readState();
      const domBefore = await readDom(page);
      try {
        // ONE VOCABULARY, SHARED WITH THE PROBER, and an unsupported action is an ERROR.
        //
        // This used to be a chain of `if (act.key) ... if (act.click) ...` that silently ignored
        // anything it did not recognise. A step asking for an action the harness cannot perform would
        // run zero interactions and could still be scored PASS - a required check quietly becoming a
        // pass, which is the one thing acceptance must never do.
        for (const act of step.do || []) {
          if (act.eval) { await page.evaluate(act.eval); continue; }
          if (act.reload) { await page.reload({ waitUntil: 'load', timeout: 15_000 }); await new Promise((r) => setTimeout(r, spec.loadSettleMs ?? 400)); continue; }
          await performAction(page, act, { settleMs: act.delayMs ?? 40 });
        }
        await new Promise((r) => setTimeout(r, settle));
        const state = await readState();
        const storage = await readStorage();
        const domNow = await readDom(page);
        if (dom.idsAtFirstFailure === null) {
          dom = await page.evaluate(() => {
            const lookups = (window.__nullLookups || []).slice(0, 10);
            return {
              nullLookups: lookups.map((l) => l.id),
              idsAtFirstFailure: lookups.length ? lookups[0].ids : null,
              idsAfterReady: Array.from(document.querySelectorAll('[id]')).map((n) => n.id),
              readyState: document.readyState,
            };
          }).catch(() => dom);
        }
        const ok = evaluateExpectation(step.expect, { state, before, errors: errors.slice(), storage, url, dom: domNow, domBefore });
        cases.push({
          n: step.n, name: step.name, kind: ok ? 'PASS' : 'FAIL',
          // The observed DOM goes in the record on failure, so "the filter is wrong" can be stated with
          // the expected result AND what was actually on screen, rather than inferred.
          observed: ok ? undefined : { visible: domNow.visible, inputValues: domNow.inputValues },
          text: ok ? '' : `expected ${step.expect}; state ${JSON.stringify(state).slice(0, 200)}; visible ${JSON.stringify(domNow.visible).slice(0, 200)}${errors.length ? '; errors: ' + errors.slice(-2).join(' | ') : ''}`,
        });
        lines.push(`${ok ? 'PASS' : 'FAIL'} case ${step.n}  ${step.name}${ok ? '' : ' -> ' + cases[cases.length - 1].text}`);
      } catch (e) {
        const unsupported = e && e.name === 'UnsupportedAction';
        cases.push({
          n: step.n, name: step.name, kind: 'ERROR', unsupportedAction: unsupported || undefined,
          text: (unsupported ? 'UNSUPPORTED ACTION - this check could not be performed and is NOT a pass: ' : '') + String(e.message || e).slice(0, 200),
        });
        lines.push(`ERROR case ${step.n}  ${step.name}: ${String(e.message || e).slice(0, 160)}`);
      }
    }
  } catch (e) {
    return { status: 'UNAVAILABLE', reason: `the browser could not run the play: ${String(e.message || e).slice(0, 200)}`, passing: new Set(), failing: new Set(), total: null, cases, log: lines.join('\n') };
  } finally {
    try { if (browser) await browser.close(); } catch { /* best effort */ }
    try { srv.close(); } catch { /* best effort */ }
  }
  const passing = new Set(cases.filter((c) => c.kind === 'PASS').map((c) => c.n));
  const failing = new Set(cases.filter((c) => c.kind !== 'PASS').map((c) => c.n));
  const total = cases.length;
  lines.push(`SUMMARY ${passing.size}/${total} cases pass, ${failing.size} fail`);
  return { status: 'OK', passing, failing, total, cases, errors, stacks, dom, log: lines.join('\n') };
}
