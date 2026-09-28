#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// renderEvidence.mjs — is the reported state consistent with what the page actually DRAWS?
//
//   node server/renderEvidence.mjs --file <page.html> --keys "a,a,0,0,a"
//
// WHY. Every check in this project reads `window.app.state()`. That single seam is the only evidence,
// and a page can satisfy it while the visible application does something else - not necessarily by
// deception, equally by an ordinary bug in the accessor. `legasus/bench/seq1/deceptive` is a hand-written
// page that passes ALL SEVEN checks of an accepted addition while its scoreboard keeps showing the old
// scores, so this is a demonstrated gap rather than a hypothetical one.
//
// This adds a SECOND, INDEPENDENT source: a hash of the canvas pixels after every step. Two consistency
// rules, both page-independent:
//
//   FUNCTIONAL  the same reported state must always render the same way. One state showing two
//               different pictures means the picture is not driven by the state.
//   INJECTIVE   two DIFFERENT reported states must not render identically. This is the rule that catches
//               a lying accessor: the deceptive page reports {0,0} while still showing the "2" picture.
//
// NEITHER RULE IS UNIVERSALLY VALID, and this module is a HEURISTIC, not a definition of visual
// correctness. All three of these are legitimate and would be flagged or missed:
//   different states CAN look identical - an inventory count, a hidden flag, an off-screen object
//   the same state CAN look different - an animation frame, a cursor, any unreported visual state
//   consistent pixels can still depict the WRONG RESULT - a program that always draws the wrong score
//     while reporting the expected one satisfies both rules perfectly
// So a pass means "no contradiction detected by these two rules on the traces exercised". It adds
// evidence. It does not establish that the software is correct, and for a scoreboard the stronger and
// task-specific requirement is that the DISPLAYED TOTALS match the expected totals once rendering has
// settled - which pixel relationships can help test and cannot replace.
//
// An earlier version compared against the picture AT LOAD instead, and flagged the GENUINE accepted page
// as a contradiction - a false positive that would have condemned working software, caught only because
// the genuine page was run as a control. That page simply never draws at load.
//
// It is NOT part of the gate. playCheck stays byte-identical, so nothing here can silently move a
// verdict; this is evidence to be read, and folding it into acceptance is a separate, declared decision.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, normalize, extname } from 'node:path';
import { createHash } from 'node:crypto';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
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

export async function renderEvidence(dir, { keys = [], expr = 'window.app.state()', entry = 'index.html', browserPath = null } = {}) {
  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch { return { ok: false, reason: 'puppeteer-core is not installed' }; }
  const { srv, port } = await serveDir(dir);
  const errors = [];
  let browser = null;
  try {
    let base = {};
    try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back */ }
    browser = await puppeteer.launch({ ...base, executablePath: browserPath || base.executablePath, headless: true, args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage'], timeout: 20_000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    page.on('pageerror', (e) => errors.push(`[JS ERROR] ${String(e.message || e)}`.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(`[console.error] ${m.text()}`.slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${port}/${entry}`, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForFunction('document.readyState === "complete"', { timeout: 5_000 }).catch(() => {});

    const look = async () => page.evaluate((e) => {
      let state = null, threw = null;
      try { const v = new Function(`return (${e});`)(); state = v === undefined ? null : JSON.parse(JSON.stringify(v)); }
      catch (err) { threw = String(err && err.message || err); }
      // Every canvas on the page, concatenated, so a page with more than one is still covered.
      const cs = Array.from(document.querySelectorAll('canvas'));
      let pixels = null;
      try { pixels = cs.map((c) => c.toDataURL()).join('|'); } catch (err) { pixels = 'UNREADABLE:' + String(err && err.message || err); }
      // BLANK IS MEASURED, NOT GUESSED. Whether the page has drawn anything yet decides which
      // observations the rules may use, and inferring it from "the hash changed later" threw away the
      // load observation on pages that DO draw at load - losing coverage for no reason.
      let blank = true;
      try {
        for (const c of cs) {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { blank = false; break; } }
          if (!blank) break;
        }
      } catch { blank = null; }
      return { state, threw, pixels, blank, canvasCount: cs.length, text: document.body ? document.body.innerText.slice(0, 200) : '' };
    }, expr);

    const obs = [];
    const first = await look();
    obs.push({ after: null, state: first.state, threw: first.threw, renderHash: sha(first.pixels), blank: first.blank, text: first.text, canvasCount: first.canvasCount });
    for (const k of keys) {
      await page.keyboard.press(k).catch(() => {});
      await new Promise((r) => setTimeout(r, 40));
      const o = await look();
      obs.push({ after: k, state: o.state, threw: o.threw, renderHash: sha(o.pixels), blank: o.blank, text: o.text, canvasCount: o.canvasCount });
    }

    // ── THE RULES, and the false positive that forced them ──────────────────────────────────────
    //
    // The first version of this file compared every "state is back to its load value" observation
    // against the PICTURE AT LOAD. On the deceptive page that flagged the lie correctly - and on the
    // GENUINE accepted page it flagged a contradiction too. A false positive that would have condemned
    // working software, caught only because the genuine page was run as a control.
    //
    // The cause is ordinary: that page never draws at load. Its canvas is blank until the first key
    // press, so after a real reset the picture legitimately differs from the blank one while the state
    // matches. "Looks like it did at load" was never the right claim.
    //
    // What IS a claim about working software, and is page-independent:
    //   FUNCTIONAL  the same reported state must always render the same way. If one state shows two
    //               different pictures, the picture is not being driven by the state.
    //   INJECTIVE   two DIFFERENT reported states must not render identically. This is the rule that
    //               catches a lying accessor: the deceptive page reports {0,0} while still showing the
    //               "2" picture, so {2,0} and {0,0} share a rendering.
    // Both are evaluated only from the first observation at which the page has drawn anything, because
    // before that the rendering cannot be a function of anything.
    // The rules apply from the first observation at which the page has actually DRAWN something. A blank
    // canvas cannot be a function of anything.
    const firstDrawn = obs.findIndex((o) => o.blank === false);
    const from = firstDrawn === -1 ? obs.length : firstDrawn;
    const considered = obs.slice(from).filter((o) => !o.threw);

    const byState = new Map();
    const byHash = new Map();
    for (const o of considered) {
      const k = JSON.stringify(o.state);
      if (!byState.has(k)) byState.set(k, new Set());
      byState.get(k).add(o.renderHash);
      if (!byHash.has(o.renderHash)) byHash.set(o.renderHash, new Set());
      byHash.get(o.renderHash).add(k);
    }
    const notFunctional = [...byState.entries()].filter(([, h]) => h.size > 1)
      .map(([st, h]) => ({ state: st, renderings: [...h].map((x) => x.slice(0, 12)) }));
    const notInjective = [...byHash.entries()].filter(([, st]) => st.size > 1)
      .map(([h, st]) => ({ renderHash: h.slice(0, 12), states: [...st] }));

    const distinctStates = byState.size;
    const disagreements = [...notFunctional.map((x) => ({ kind: 'SAME_STATE_TWO_PICTURES', ...x })),
                           ...notInjective.map((x) => ({ kind: 'TWO_STATES_ONE_PICTURE', ...x }))];

    // COVERAGE, PER RULE, BECAUSE THE TWO ARE EXERCISED BY DIFFERENT THINGS.
    //   the FUNCTIONAL rule needs a state to be REVISITED - seen at least twice. Two distinct states do
    //   not exercise it at all, and an earlier version of this file reported AGREES on that basis, which
    //   credited a rule that had never run.
    //   the INJECTIVE rule needs at least two DISTINCT states.
    const revisitedStates = [...byState.entries()].filter(([, h]) => h.size >= 1)
      .filter(([k]) => considered.filter((o) => JSON.stringify(o.state) === k).length > 1).length;
    const coverage = {
      functionalRuleExercised: revisitedStates > 0,
      revisitedStates,
      injectiveRuleExercised: distinctStates >= 2,
      distinctStates,
      observationsConsidered: considered.length,
    };

    // A PASS THAT CANNOT FAIL IS NOT EVIDENCE. The verdict is only AGREES when at least one rule was
    // actually exercised, and the coverage above says WHICH.
    const anyExercised = coverage.functionalRuleExercised || coverage.injectiveRuleExercised;
    const verdict = disagreements.length ? 'RENDER_CONTRADICTS_STATE'
      : (anyExercised ? 'RENDER_AGREES' : 'RENDER_EVIDENCE_VACUOUS');

    return {
      ok: true, observations: obs, loadHash: obs[0].renderHash, verdict, disagreements,
      notFunctional, notInjective, distinctStates, coverage,
      consideredFrom: from, drewAtLoad: obs[0].blank === null ? null : obs[0].blank === false,
      errors, canvasCount: first.canvasCount,
      // WHAT A PASS MEANS, carried in the result so a reader cannot take more from it than it holds.
      meaning: 'no contradiction detected by these two rules on the traces exercised; not a finding that the software is correct',
    };
  } catch (e) {
    return { ok: false, reason: `the browser could not gather render evidence: ${String(e.message || e).slice(0, 200)}` };
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
  if (!FILE) { console.error('usage: node server/renderEvidence.mjs --file <page.html> --keys "a,a,0"'); process.exit(2); }
  const keys = String(opt('keys', '')).split(',').map((k) => k.trim()).filter(Boolean);
  const ws = mkdtempSync(join(tmpdir(), 'render-'));
  try {
    writeFileSync(join(ws, 'index.html'), readFileSync(FILE, 'utf8'), 'utf8');
    const r = await renderEvidence(ws, { keys });
    if (!r.ok) { console.log(`UNAVAILABLE: ${r.reason}`); process.exit(0); }
    console.log(`${FILE}\n  canvases ${r.canvasCount}   errors ${r.errors.length}`);
    for (const o of r.observations) {
      console.log(`  after ${String(o.after ?? 'load').padEnd(6)} state ${JSON.stringify(o.state).padEnd(30)} render ${o.renderHash.slice(0, 12)}`);
    }
    console.log(`\n  coverage, per rule:`);
    console.log(`    INJECTIVE  (distinct states must not share a picture) exercised: ${r.coverage.injectiveRuleExercised}  - ${r.coverage.distinctStates} distinct states`);
    console.log(`    FUNCTIONAL (a revisited state must look the same)     exercised: ${r.coverage.functionalRuleExercised}  - ${r.coverage.revisitedStates} states revisited`);
    for (const d of r.disagreements) {
      if (d.kind === 'SAME_STATE_TWO_PICTURES') console.log(`    CONTRADICTS: state ${d.state} rendered ${d.renderings.length} different ways (${d.renderings.join(', ')})`);
      else console.log(`    CONTRADICTS: one picture ${d.renderHash} for ${d.states.length} different states (${d.states.join(' and ')})`);
    }
    if (!r.disagreements.length) console.log(`    ${r.meaning}`);
    console.log(`\n  VERDICT ${r.verdict}`);
    process.exit(r.verdict === 'RENDER_AGREES' ? 0 : (r.verdict === 'RENDER_EVIDENCE_VACUOUS' ? 2 : 1));
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
