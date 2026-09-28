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
import { perform as performAction } from './actions.mjs';
import { OUTCOME, adaptersFor, coverage } from './adapters/interface.mjs';
import './adapters/browser.mjs';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const sha = (t) => createHash('sha256').update(String(t)).digest('hex');

/** The frozen probe budget. Declared here, not chosen per application. */
export const BUDGET = {
  maxPlans: 8, maxInteractionsPerPlan: 12, maxTotalInteractions: 60, pageTimeoutMs: 20_000,
  // ONE INTERACTION IS NOT ALWAYS ENOUGH TO REVEAL BEHAVIOUR, and the fix is a bounded sequence rather
  // than a rule for any particular page. Each distinct interaction is repeated this many times from a
  // FRESH page, with every intermediate result recorded.
  //
  // Why 3: a toggle needs 2 to complete a cycle, and a third shows the cycle repeating. OBSEVAL-1's
  // e5-notes is hidden by a stylesheet while its handler tests the INLINE style, so its first click
  // hides an already-hidden list and only the second reveals it - one click reported NO_CHANGE_OBSERVED,
  // which was true of the probe and misleading about the application.
  repeatsPerInteraction: 3,
};

/** How an interaction behaved across its repeat sequence. These are DIAGNOSTIC, not verdicts. */
export const EFFECT = {
  IMMEDIATE: 'IMMEDIATE_EFFECT',                 // changed on the first repetition
  SEQUENCE_DEPENDENT: 'SEQUENCE_DEPENDENT_EFFECT', // changed only after repeating
  NONE: 'NO_EFFECT_OBSERVED',                    // no change across the whole sequence
};

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
    // VISIBILITY, and only the cases this supports. display:none on an ANCESTOR leaves a child's own
    // computed display untouched - that is the defect OBSEVAL-1 found - so rendered rectangles decide
    // it. visibility:hidden leaves rectangles intact, so it is checked separately.
    const isVisible = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.visibility === 'collapse') return false;
      return true;
    };
    const vis = [];
    const texts = [];
    for (const el of document.body ? document.body.querySelectorAll('*') : []) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim();
      if (el.children.length === 0 && t) { vis.push(el.tagName + ':' + t); texts.push(t); }
    }
    out.visibleText = vis.join('|');
    out.visibleSample = texts.slice(0, 12);
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
    // Every repetition is an executed action and counts against budget.maxTotalInteractions.
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
      visibilitySupported: ['display:none on self or any ancestor', 'visibility:hidden, including inherited', 'the hidden attribute'],
      visibilityNotCovered: ['opacity:0', 'clip-path', 'off-screen transforms', 'overflow-hidden zero-size containers', 'scrolled out of view', 'aria-hidden', 'covered by another element'],
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

    // ── 3. PROBE. Each distinct interaction gets its OWN FRESH PAGE and is repeated a declared number
    // of times, with every intermediate result recorded. Resetting between sequences is what stops one
    // interaction from silently setting up - or destroying - the conditions another is judged under.
    for (const plan of plans) {
      if (record.interactionsUsed >= budget.maxTotalInteractions) {
        record.unresolved.push(`the interaction budget (${budget.maxTotalInteractions}) ran out before plan ${plan.id} was tried`);
        break;
      }
      const sequences = [];
      const probeErrors = [];
      let probeError = null;
      const distinct = plan.interactions.slice(0, budget.maxInteractionsPerPlan);

      for (const it of distinct) {
        if (record.interactionsUsed >= budget.maxTotalInteractions) break;
        let page = null;
        const steps = [];
        try {
          page = await freshPage(probeErrors);                  // RESET before this sequence
          const initial = await page.evaluate(`(${SNAPSHOT})()`);
          let prev = initial;
          for (let rep = 1; rep <= budget.repeatsPerInteraction; rep++) {
            if (record.interactionsUsed >= budget.maxTotalInteractions) break;
            record.interactionsUsed++;
            try {
              await performAction(page, it, { settleMs: 40 });
            } catch (e) {
              steps.push({ repetition: rep, performed: false, error: String(e.message || e).slice(0, 140) });
              break;
            }
            const now = await page.evaluate(`(${SNAPSHOT})()`);
            steps.push({
              repetition: rep, performed: true,
              changedFromPrevious: changedBetween(prev, now),
              changedFromInitial: changedBetween(initial, now),
              seam: now.seam, domDigest: digest(now.domDigest), canvasDigest: digest(now.canvasDigest),
            });
            prev = now;
          }
        } catch (e) { probeError = String(e.message || e).slice(0, 180); }
        finally { try { if (page) await page.close(); } catch { /* best effort */ } }

        const performed = steps.filter((x) => x.performed);
        const firstChange = performed.find((x) => x.changedFromInitial.any);
        const effect = !performed.length ? null
          : (firstChange ? (firstChange.repetition === 1 ? EFFECT.IMMEDIATE : EFFECT.SEQUENCE_DEPENDENT) : EFFECT.NONE);
        sequences.push({
          interaction: it, repetitions: steps.length, effect,
          firstChangeAtRepetition: firstChange ? firstChange.repetition : null,
          selfEffectOnly: !firstChange && performed.some((x) => x.changedFromInitial.selfEffect),
          steps,
        });
      }

      const performedAny = sequences.some((q) => q.steps.some((x) => x.performed));
      const effective = sequences.filter((q) => q.effect === EFFECT.IMMEDIATE || q.effect === EFFECT.SEQUENCE_DEPENDENT);
      const delayed = sequences.filter((q) => q.effect === EFFECT.SEQUENCE_DEPENDENT);
      const probe = {
        planId: plan.id, adapterId: plan.adapterId,
        probeError, pageErrors: probeErrors,
        repeatsPerInteraction: budget.repeatsPerInteraction,
        // ACCOUNTING, stated precisely. A sequence of 3 repetitions is 3 EXECUTED ACTIONS, and every one
        // of them counts against the probe budget - `distinctInteractions` is how many different things
        // were tried, never how much budget was spent.
        distinctInteractions: sequences.length,
        distinctInteractionsPerformed: sequences.filter((q) => q.steps.some((x) => x.performed)).length,
        executedActions: sequences.reduce((n, q) => n + q.steps.filter((x) => x.performed).length, 0),
        sequences,
        effective: effective.map((q) => ({ interaction: q.interaction, changed: q.steps.find((x) => x.changedFromInitial.any).changedFromInitial, atRepetition: q.firstChangeAtRepetition })),
        selfEffectOnly: sequences.filter((q) => q.selfEffectOnly).map((q) => ({ interaction: q.interaction })),
        sequenceDependent: delayed.map((q) => ({ interaction: q.interaction, atRepetition: q.firstChangeAtRepetition })),
        outcome: probeError ? OUTCOME.PROBE_ERROR
          : (!performedAny ? OUTCOME.PROBE_ERROR
            : (effective.length ? OUTCOME.CONFIRMED_BEHAVIOUR : OUTCOME.NO_CHANGE_OBSERVED)),
      };
      record.probes.push(probe);
      if (delayed.length) {
        record.unresolved.push(`${delayed.length} interaction(s) produced NO effect on the first attempt and only became observable after repeating (at repetition ${delayed.map((q) => q.firstChangeAtRepetition).join(', ')}). THAT THE BEHAVIOUR BECAME OBSERVABLE IS NOT A FINDING THAT IT IS CORRECT: whether a control meets its requirement - "each press toggles" say - is judged against the requirement, and a first press that does nothing may itself be a defect.`);
      }
      if (probe.outcome === OUTCOME.CONFIRMED_BEHAVIOUR) {
        record.selected.push({
          adapterId: plan.adapterId, planId: plan.id,
          why: `probing ${plan.what} produced an observable change`,
          effects: probe.effective.map((e) => ({ interaction: e.interaction, atRepetition: e.atRepetition, channels: Object.entries(e.changed).filter(([k, v]) => v && k !== 'any').map(([k]) => k) })),
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
    for (const p of r.probes) console.log(`    ${p.adapterId.padEnd(18)} ${p.outcome.padEnd(22)} ${p.distinctInteractionsPerformed} interaction(s) x${p.repeatsPerInteraction} = ${p.executedActions} executed actions, ${p.effective.length} produced a change${p.sequenceDependent.length ? `, ${p.sequenceDependent.length} only after repeating` : ''}`);
    console.log(`  budget: ${r.interactionsUsed} of ${r.budget.maxTotalInteractions} executed actions used`);
    console.log(`  SELECTED: ${r.selected.map((x) => x.adapterId).join(', ') || 'none'}`);
    console.log(`  OUTCOME:  ${r.outcome}`);
    for (const u of r.unresolved) console.log(`    unresolved: ${u}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
