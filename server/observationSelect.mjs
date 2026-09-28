#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// observationSelect.mjs — work out HOW to observe an unfamiliar browser application, without being told
// what kind of application it is.
//
//   node server/observationSelect.mjs --file <page.html>
//
// THE DEFECT THIS EXISTS TO FIX. BATCH-1's probe pressed bare keydowns on the document and nothing else.
// A working input-driven filter - one that binds `input` events and updates a list - was reported as
// NO_EXISTING_BEHAVIOUR. That confused "our observation method is unsuitable" with "the application does
// nothing", and two of four applications were written off on the strength of it.
//
// HOW IT WORKS
//   1. SCAN     load the page with addEventListener patched BEFORE any page script runs, so every
//               registration is recorded - including dynamically added and delegated ones. Collect the
//               interaction surfaces too: inputs, clickables, forms, canvases.
//   2. PROPOSE  ask every registered adapter which plans it proposes given that evidence. A plan carries
//               its evidence and its uncertainty. IT IS A HYPOTHESIS, not a classification.
//   3. PROBE    run each plan's interactions in a FRESHLY RELOADED page, within a frozen budget, and
//               observe the result as STRUCTURED VALUES - a state seam if one exists, a DOM digest, and
//               a canvas digest. Never by parsing an assertion message.
//   4. SELECT   keep the adapters whose probes produced an observable effect. A mixed application can
//               select several.
//
// WHAT IT REFUSES TO CONCLUDE. If nothing changes, the answer is NO_CHANGE_OBSERVED - under the probes
// attempted, within this budget. That is never reported as "the application has no behaviour".
//
// WHAT IT DOES NOT DECIDE. Responsiveness is not correctness. An input that changes a list shows the
// list responds; whether it FILTERS CORRECTLY comes from requirements and independently defined checks.
// Selecting an adapter is not permission to retain anything.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, normalize, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { OUTCOME, adaptersFor, coverage } from './adapters/interface.mjs';
import './adapters/browser.mjs';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const sha = (t) => createHash('sha256').update(String(t)).digest('hex');

/** The frozen probe budget. Declared here, not chosen per application. */
export const BUDGET = { maxPlans: 8, maxInteractionsPerPlan: 12, maxTotalInteractions: 60, pageTimeoutMs: 20_000 };

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

// Installed before any page script. Records every addEventListener call, whoever makes it and whenever.
const RECORDER = `(() => {
  window.__regs = [];
  const name = (t) => {
    try {
      if (t === window) return 'window';
      if (t === document) return 'document';
      if (t && t.tagName) return t.id ? t.tagName.toLowerCase() + '#' + t.id : t.tagName.toLowerCase();
      return String(t && t.constructor && t.constructor.name || t);
    } catch { return 'unknown'; }
  };
  const patch = (proto) => {
    if (!proto || !proto.addEventListener) return;
    const orig = proto.addEventListener;
    proto.addEventListener = function (type, fn, opts) {
      try { window.__regs.push({ type: String(type), target: name(this), at: Date.now() }); } catch {}
      return orig.call(this, type, fn, opts);
    };
  };
  patch(EventTarget && EventTarget.prototype);
})()`;

const SNAPSHOT = `() => {
  const out = { seam: null, seamThrew: null, domDigest: null, canvasDigest: null, visibleText: null, elementCount: null };
  try {
    if (window.app && typeof window.app.state === 'function') {
      out.seam = JSON.parse(JSON.stringify(window.app.state()));
    }
  } catch (e) { out.seamThrew = String(e && e.message || e); }
  try {
    const vis = [];
    for (const el of document.body ? document.body.querySelectorAll('*') : []) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (el.children.length === 0 && el.textContent.trim()) vis.push(el.tagName + ':' + el.textContent.trim());
    }
    out.visibleText = vis.join('|');
    out.elementCount = vis.length;
    out.domDigest = out.visibleText;
  } catch {}
  try {
    const cs = Array.from(document.querySelectorAll('canvas'));
    if (cs.length) out.canvasDigest = cs.map((c) => c.toDataURL()).join('|');
  } catch {}
  // THE INTERACTION'S OWN EFFECT, kept apart from the downstream result. Typing changes an input's value
  // whether or not the application reacts, so folding the two together would call every keystroke
  // 'behaviour'. domDigest above reads only leaf TEXT, which an input value is not part of.
  try {
    const iv = {};
    for (const el of document.querySelectorAll('input, textarea, select')) {
      iv[el.id ? '#' + el.id : (el.name || el.tagName.toLowerCase())] = el.value;
    }
    out.inputValues = iv;
  } catch {}
  return out;
}`;

const SURFACES = `() => {
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const t = el.tagName.toLowerCase();
    const sibs = Array.from(document.querySelectorAll(t));
    return sibs.length > 1 ? t + ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')' : t;
  };
  const inputs = Array.from(document.querySelectorAll('input, textarea')).map((e) => ({ selector: sel(e), type: (e.getAttribute('type') || '').toLowerCase(), id: e.id || null }));
  const clickables = Array.from(document.querySelectorAll('button, a[href], [role=button], input[type=button], input[type=submit]')).map((e) => ({ selector: sel(e), text: (e.textContent || '').trim().slice(0, 40) }));
  const forms = Array.from(document.querySelectorAll('form')).map((e) => ({ selector: sel(e) }));
  const canvases = Array.from(document.querySelectorAll('canvas')).map((e) => ({ selector: sel(e), width: e.width, height: e.height }));
  const selects = Array.from(document.querySelectorAll('select')).map((e) => ({ selector: sel(e) }));
  // MECHANISMS THIS LAYER DOES NOT CAPTURE. Patching addEventListener sees registrations made through
  // THAT API. These are the other ways a page can attach behaviour, detected so they can be REPORTED as
  // uncovered rather than silently missed.
  const EVENT_ATTRS = ['onclick', 'oninput', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onmousedown'];
  const inlineHandlers = [];
  for (const el of document.querySelectorAll('*')) {
    for (const a of EVENT_ATTRS) if (el.hasAttribute && el.hasAttribute(a)) inlineHandlers.push({ selector: sel(el), attr: a });
  }
  const propertyHandlers = [];
  for (const el of document.querySelectorAll('*')) {
    for (const a of EVENT_ATTRS) {
      try { if (!el.hasAttribute(a) && typeof el[a] === 'function') propertyHandlers.push({ selector: sel(el), prop: a }); } catch {}
    }
  }
  const frames = Array.from(document.querySelectorAll('iframe, frame')).map((e) => ({ selector: sel(e), src: e.getAttribute('src') || null }));
  return {
    inputs, clickables, forms, canvases, selects,
    inlineHandlers, propertyHandlers, frames,
    hasSeam: !!(window.app && typeof window.app.state === 'function'),
  };
}`;

const digest = (s) => (s === null || s === undefined ? null : sha(JSON.stringify(s)).slice(0, 16));

/** Did anything observable change? Reported per channel, so a reader sees WHICH evidence moved. */
function changedBetween(before, after) {
  const ch = {
    seam: JSON.stringify(before.seam) !== JSON.stringify(after.seam),
    dom: before.domDigest !== after.domDigest,
    canvas: before.canvasDigest !== after.canvasDigest,
  };
  // `selfEffect` is the interaction changing its OWN control - an input now holding the typed text. It
  // is reported and is deliberately NOT part of `any`: an inert field would otherwise look responsive.
  ch.selfEffect = JSON.stringify(before.inputValues || {}) !== JSON.stringify(after.inputValues || {});
  ch.any = ch.seam || ch.dom || ch.canvas;
  return ch;
}

export async function selectObservation(dir, { entry = 'index.html', budget = BUDGET, browserPath = null } = {}) {
  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch { return { ok: false, reason: 'puppeteer-core is not installed' }; }

  const { srv, port } = await serveDir(dir);
  const url = `http://127.0.0.1:${port}/${entry}`;
  let browser = null;
  const record = {
    at: new Date().toISOString(), url: `(local) /${entry}`, budget,
    adapterCoverage: coverage(),
    loadErrors: [], registrations: [], surfaces: null,
    plans: [], probes: [], selected: [], outcome: null, unresolved: [],
    interactionsUsed: 0,
  };

  try {
    let base = {};
    try { base = (await import('../server/browser.js')).launchOptions() || {}; } catch { try { base = (await import('./browser.js')).launchOptions() || {}; } catch { /* fall back */ } }
    browser = await puppeteer.launch({
      ...base, executablePath: browserPath || base.executablePath, headless: true,
      args: [...(base.args || []), '--no-sandbox', '--disable-gpu', '--mute-audio', '--disable-dev-shm-usage'], timeout: 20_000,
    });

    /** A FRESH page for every probe, so one probe cannot alter another's starting conditions. */
    const freshPage = async (collectErrors) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(RECORDER);
      if (collectErrors) {
        page.on('pageerror', (e) => collectErrors.push(`[JS ERROR] ${String(e.message || e)}`.slice(0, 200)));
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) collectErrors.push(`[console.error] ${m.text()}`.slice(0, 200)); });
      }
      await page.goto(url, { waitUntil: 'load', timeout: budget.pageTimeoutMs });
      await page.waitForFunction('document.readyState === "complete"', { timeout: 5_000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));   // let deferred registration settle
      return page;
    };

    // ── 1. SCAN ──
    const scanPage = await freshPage(record.loadErrors);
    record.registrations = await scanPage.evaluate('window.__regs || []');
    record.surfaces = await scanPage.evaluate(`(${SURFACES})()`);
    const atLoad = await scanPage.evaluate(`(${SNAPSHOT})()`);
    // WHAT THE REGISTRATION CAPTURE DOES AND DOES NOT SEE, recorded for every application.
    const sf = record.surfaces;
    record.coverageLimits = {
      captures: 'listeners registered through addEventListener, at any time, including delegated ones on document or body',
      doesNotCapture: [
        'inline handler attributes such as onclick="..." in the markup',
        'handlers assigned to element properties, e.g. el.onclick = fn',
        'anything inside an iframe or frame - a separate document this layer never enters',
        'handlers registered after observation finished',
      ],
      detectedButUncovered: {
        inlineHandlers: sf.inlineHandlers || [],
        propertyHandlers: sf.propertyHandlers || [],
        frames: sf.frames || [],
      },
      anyDetected: !!((sf.inlineHandlers || []).length || (sf.propertyHandlers || []).length || (sf.frames || []).length),
    };
    if (record.coverageLimits.anyDetected) {
      const bits = [];
      if ((sf.inlineHandlers || []).length) bits.push(`${sf.inlineHandlers.length} inline handler attribute(s)`);
      if ((sf.propertyHandlers || []).length) bits.push(`${sf.propertyHandlers.length} property-assigned handler(s)`);
      if ((sf.frames || []).length) bits.push(`${sf.frames.length} frame(s)`);
      record.unresolved.push(`this application uses handler mechanisms the registration capture does not see: ${bits.join(', ')}. Behaviour reached only through them is UNCOVERED, and any "no change observed" here is correspondingly weaker.`);
    }
    record.atLoad = { seam: atLoad.seam, seamThrew: atLoad.seamThrew, elementCount: atLoad.elementCount, domDigest: digest(atLoad.domDigest), canvasDigest: digest(atLoad.canvasDigest) };
    await scanPage.close();

    // A page that threw while loading is a BASELINE ERROR - the application failed, not our method.
    if (record.loadErrors.length) {
      record.outcome = OUTCOME.BASELINE_ERROR;
      record.unresolved.push('the application raised errors while loading, so no probe result would be attributable to the interaction');
      return { ok: true, ...record };
    }

    // ── 2. PROPOSE ──
    const evidence = { registrations: record.registrations, surfaces: record.surfaces, atLoad };
    let plans = [];
    for (const a of adaptersFor('browser')) {
      try { plans.push(...(a.propose(evidence) || [])); }
      catch (e) { record.unresolved.push(`adapter ${a.id} failed to propose: ${String(e.message || e).slice(0, 120)}`); }
    }
    plans.sort((x, y) => y.priority - x.priority);
    plans = plans.slice(0, budget.maxPlans);
    record.plans = plans.map((p) => ({ id: p.id, adapterId: p.adapterId, what: p.what, evidence: p.evidence, uncertainty: p.uncertainty, priority: p.priority, interactions: p.interactions.length }));

    if (!plans.length) {
      record.outcome = OUTCOME.UNSUPPORTED_OBSERVATION;
      record.unresolved.push('no registered adapter proposed a way to interact with this application; its surfaces and listener registrations matched none of them');
      return { ok: true, ...record };
    }

    // ── 3. PROBE, each in a fresh page, within the budget ──
    for (const plan of plans) {
      if (record.interactionsUsed >= budget.maxTotalInteractions) {
        record.unresolved.push(`the interaction budget (${budget.maxTotalInteractions}) ran out before plan ${plan.id} was tried`);
        break;
      }
      const probeErrors = [];
      let page = null;
      const steps = [];
      let probeError = null;
      try {
        page = await freshPage(probeErrors);
        let prev = await page.evaluate(`(${SNAPSHOT})()`);
        const interactions = plan.interactions.slice(0, budget.maxInteractionsPerPlan);
        for (const it of interactions) {
          if (record.interactionsUsed >= budget.maxTotalInteractions) break;
          record.interactionsUsed++;
          try {
            if (it.kind === 'key') { await page.keyboard.press(it.key); }
            else if (it.kind === 'type') {
              await page.focus(it.selector);
              await page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.value = ''; } }, it.selector);
              await page.type(it.selector, it.text, { delay: 5 });
              // Dispatch the events a page is likely to listen for, beyond what typing already fires.
              await page.evaluate((s) => {
                const e = document.querySelector(s);
                if (!e) return;
                e.dispatchEvent(new Event('input', { bubbles: true }));
                e.dispatchEvent(new Event('change', { bubbles: true }));
              }, it.selector);
            } else if (it.kind === 'click') { await page.click(it.selector); }
            else if (it.kind === 'submit') {
              await page.evaluate((s) => { const f = document.querySelector(s); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }, it.selector);
            }
          } catch (e) {
            steps.push({ interaction: it, performed: false, error: String(e.message || e).slice(0, 140) });
            continue;
          }
          await new Promise((r) => setTimeout(r, 40));
          const now = await page.evaluate(`(${SNAPSHOT})()`);
          const ch = changedBetween(prev, now);
          steps.push({
            interaction: it, performed: true, changed: ch,
            seam: now.seam, seamThrew: now.seamThrew,
            domDigest: digest(now.domDigest), canvasDigest: digest(now.canvasDigest), elementCount: now.elementCount,
          });
          prev = now;
        }
      } catch (e) { probeError = String(e.message || e).slice(0, 180); }
      finally { try { if (page) await page.close(); } catch { /* best effort */ } }

      const effective = steps.filter((s) => s.performed && s.changed && s.changed.any);
      // Interactions that moved only their own control - a field that accepted text while the page did
      // nothing with it. Reported so "the interaction happened" is never mistaken for "it did something".
      const selfOnly = steps.filter((s) => s.performed && s.changed && !s.changed.any && s.changed.selfEffect);
      const performedAny = steps.some((s) => s.performed);
      const probe = {
        planId: plan.id, adapterId: plan.adapterId,
        probeError, pageErrors: probeErrors,
        interactionsTried: steps.length, interactionsPerformed: steps.filter((s) => s.performed).length,
        effective: effective.map((s) => ({ interaction: s.interaction, changed: s.changed })),
        selfEffectOnly: selfOnly.map((s) => ({ interaction: s.interaction })),
        steps,
        outcome: probeError ? OUTCOME.PROBE_ERROR
          : (!performedAny ? OUTCOME.PROBE_ERROR
            : (effective.length ? OUTCOME.CONFIRMED_BEHAVIOUR : OUTCOME.NO_CHANGE_OBSERVED)),
      };
      record.probes.push(probe);
      if (probe.outcome === OUTCOME.CONFIRMED_BEHAVIOUR) {
        record.selected.push({
          adapterId: plan.adapterId, planId: plan.id,
          why: `probing ${plan.what} produced an observable change`,
          effects: probe.effective.map((e) => ({ interaction: e.interaction, channels: Object.entries(e.changed).filter(([k, v]) => v && k !== 'any').map(([k]) => k) })),
          evidence: plan.evidence, uncertainty: plan.uncertainty,
        });
      }
    }

    // ── 4. SELECT and classify ──
    if (record.selected.length) {
      record.outcome = OUTCOME.CONFIRMED_BEHAVIOUR;
    } else if (record.probes.every((p) => p.outcome === OUTCOME.PROBE_ERROR)) {
      record.outcome = OUTCOME.PROBE_ERROR;
      record.unresolved.push('every probe failed to execute, so nothing is known about the application');
    } else {
      record.outcome = OUTCOME.NO_CHANGE_OBSERVED;
      const selfTotal = record.probes.reduce((n, p) => n + (p.selfEffectOnly || []).length, 0);
      record.unresolved.push(`no probed interaction changed the seam, the DOM or the canvas. THIS IS NOT A FINDING THAT THE APPLICATION HAS NO BEHAVIOUR: ${record.plans.length} plan(s) were tried within a budget of ${budget.maxTotalInteractions} interactions, and any interaction outside them is uncovered.`);
      if (selfTotal) record.unresolved.push(`${selfTotal} interaction(s) DID change their own control - a field accepted the text - without any downstream result. The interaction reached the application; the application did not visibly react. That is still NOT a finding that its implementation is defective: establishing THAT needs an expected result to compare against.`);
      const untried = ['drag', 'hover', 'scroll', 'select-option', 'file-upload', 'timer-driven updates'];
      record.unresolved.push(`interaction kinds this layer does not support at all: ${untried.join(', ')}`);
    }
    return { ok: true, ...record };
  } catch (e) {
    return { ok: false, reason: `selection failed: ${String(e.message || e).slice(0, 200)}`, ...record };
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
  if (!FILE) { console.error('usage: node server/observationSelect.mjs --file <page.html>'); process.exit(2); }
  const ws = mkdtempSync(join(tmpdir(), 'obssel-'));
  try {
    writeFileSync(join(ws, 'index.html'), readFileSync(FILE, 'utf8'), 'utf8');
    const r = await selectObservation(ws);
    if (!r.ok) { console.log(`UNAVAILABLE: ${r.reason}`); process.exit(3); }
    console.log(`${FILE}`);
    console.log(`  load errors ${r.loadErrors.length}   registrations: ${r.registrations.map((x) => `${x.type}@${x.target}`).join(', ') || 'none'}`);
    const s = r.surfaces;
    console.log(`  surfaces: ${s.inputs.length} input(s), ${s.clickables.length} clickable(s), ${s.forms.length} form(s), ${s.canvases.length} canvas(es), seam ${s.hasSeam}`);
    console.log(`  plans proposed: ${r.plans.length}`);
    for (const p of r.plans) console.log(`    ${p.adapterId.padEnd(18)} ${p.what}`);
    console.log(`  probes:`);
    for (const p of r.probes) console.log(`    ${p.adapterId.padEnd(18)} ${p.outcome.padEnd(22)} ${p.interactionsPerformed} performed, ${p.effective.length} produced a change`);
    console.log(`  SELECTED: ${r.selected.map((x) => x.adapterId).join(', ') || 'none'}`);
    console.log(`  OUTCOME:  ${r.outcome}`);
    for (const u of r.unresolved) console.log(`    unresolved: ${u}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
