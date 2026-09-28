#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// emitTaskAuto.mjs — build a task whose CHECKS use whatever interactions Legasus selected.
//
//   node server/emitTaskAuto.mjs --dir <page dir>
//
// The old emitter assumed keys. So an input-driven application could be OBSERVED but never TASKED, and
// the evaluation would have quietly excluded exactly the applications this work is for.
//
// TWO SOURCES, KEPT APART, as they have been since the first emitter:
//   the CARRIED-FORWARD checks describe what the application ALREADY does, and their expectations come
//     from OBSERVATION - the confirmed interactions and the result they produced. These are PROPOSED
//     preservation, not established obligations: observing a behaviour does not establish that it was
//     intended, and a defect in the delivered page becomes a check that protects the defect. Only a
//     requirement can separate the two, and this emitter is not given one for the existing behaviour.
//   the ADDITION's checks come from the frozen REQUIREMENT, never from the candidate. They cannot come
//     from observation because the behaviour does not exist yet, and on the baseline they must FAIL.
//
// TWO ADDITION RULES, each fixed in advance, and the OBSERVATION picks between them:
//   FILTER  typing into a field was confirmed to govern a set of items, so the addition is a control
//           that CLEARS the filter: the field goes empty and every governed item comes back.
//   KEY     nothing like that was confirmed, so the addition is a free trigger key that returns the
//           application to the observable state it had at load.
// The earlier emitter forced the KEY rule onto every page including input-driven ones, which let the
// edit shape the guidance policy happened to support dictate what the application was asked for. The
// branch taken, and the reason it was taken, are recorded in the task.
//
// EXPECTED OUTCOMES ARE INDEPENDENT AND SEPARATE. The filter addition's two effects - the field is
// empty, and the governed items are all visible - are two checks with two separately stated
// expectations, so a control that does half the job is caught doing half the job. Neither expectation
// is read from a candidate: the governed item set is established on the page AS DELIVERED, by typing a
// term that matches nothing and recording which visible texts disappear.
//
// LIST CHECKS ARE SCOPED TO THE GOVERNED ITEMS. The addition legitimately puts a new visible control on
// the page, so a preservation check over ALL visible text would fail the moment the control appeared -
// condemning a correct change for doing exactly what it was asked to do.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const NAME = opt('name', 'baseline-as-delivered.html');
if (!DIR) { console.error('usage: node server/emitTaskAuto.mjs --dir <page dir>'); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const TRIGGERS = ['0', 'z', 'Escape', 'Backspace'];
const CONTROLS = ['#clear-filter', '#reset-filter', '#clear-all'];

const { selectObservation } = await import('./observationSelect.mjs');
const { playCheck } = await import('./playCheck.js');
const { describe: describeAction } = await import('./actions.mjs');
const { matchingTermFrom, NON_MATCHING } = await import('./adapters/browser.mjs');

const html = readFileSync(join(DIR, NAME), 'utf8');
const ws = mkdtempSync(join(tmpdir(), 'emitauto-'));
let sel;
try {
  writeFileSync(join(ws, 'index.html'), html, 'utf8');
  sel = await selectObservation(ws);
} finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }

if (!sel.ok) { console.error(`could not observe: ${sel.reason}`); process.exit(3); }
console.log(`page            ${join(DIR, NAME)}   sha ${sha(html).slice(0, 16)}`);
console.log(`observation     ${sel.outcome}   selected: ${sel.selected.map((s) => s.adapterId).join(', ') || 'none'}`);
if (sel.outcome !== 'CONFIRMED_BEHAVIOUR') {
  console.error(`NOT EMITTED: the observation outcome is ${sel.outcome}. A task needs behaviour that was actually confirmed.`);
  for (const u of sel.unresolved) console.error(`  ${u}`);
  process.exit(4);
}

// ── the confirmed interactions, in the modality the page actually responds to ──
const confirmed = [];
for (const p of sel.probes) {
  for (const e of (p.effective || [])) confirmed.push({ ...e.interaction, adapterId: p.adapterId });
}
if (!confirmed.length) { console.error('NOT EMITTED: nothing was confirmed'); process.exit(5); }
// Two distinct interactions if available, so the carried-forward set is not one lucky press.
const chosen = [];
for (const c of confirmed) {
  if (chosen.length >= 2) break;
  if (!chosen.some((x) => JSON.stringify(x) === JSON.stringify(c))) chosen.push(c);
}

const act = (i) => ({ kind: i.kind, key: i.key, selector: i.selector, text: i.text });
const runSpec = async (spec) => {
  const w = mkdtempSync(join(tmpdir(), 'emitrun-'));
  try { writeFileSync(join(w, 'index.html'), html, 'utf8'); return await playCheck(w, spec); }
  finally { if (existsSync(w)) { try { rmSync(w, { recursive: true, force: true }); } catch { /* best effort */ } } }
};
const STATE_EXPR = 'window.app && window.app.state ? window.app.state() : null';
const J = (v) => JSON.stringify(JSON.stringify(v));
const visOf = (o) => (o ? o.visible : []);
const hidOf = (o) => (o ? (o.hidden || []) : []);
const obsOf = (run, n) => { const c = ((run && run.cases) || []).find((x) => x.n === n); return c && c.observed ? c.observed : null; };

// ══ which addition rule? ═════════════════════════════════════════════════════════════════════════
// A confirmed `type` interaction is the evidence - not the filename, not a comment, not a label. Every
// branch below either establishes the filter facts on the DELIVERED page or refuses and says why.
const typed = confirmed.find((c) => c.kind === 'type');
let filter = null;
const whyNotFilter = [];
if (!typed) {
  whyNotFilter.push('no typing was confirmed to change what the page shows, so there is no filter to clear');
} else {
  const SEL = typed.selector;
  // STEP ONE: what does the filter govern? A term that matches nothing hides exactly the governed set,
  // and that question can be asked before knowing anything else about the page.
  const neg = await runSpec({
    entry: 'index.html', stateExpr: STATE_EXPR, contract: 'establish the filter-governed item set',
    steps: [
      { n: 1, name: 'load', do: [], expect: 'false' },
      { n: 2, name: 'nonmatching', do: [{ kind: 'type', selector: SEL, text: NON_MATCHING }], expect: 'false' },
    ],
  });
  const o1 = obsOf(neg, 1); const oNeg = obsOf(neg, 2);
  // THE GOVERNED SET: visible as delivered, and hidden once the term matches nothing. Established by an
  // experiment on the delivered page - not guessed from markup, and never from a candidate.
  const gone = oNeg ? new Set(hidOf(oNeg)) : new Set();
  const ITEMS = visOf(o1).filter((t) => gone.has(t));
  // STEP TWO: a term taken from THE GOVERNED ITEMS THEMSELVES, and required to separate them. Taking it
  // from arbitrary page text picks up the heading - "inve" from "Inventory" matches no part at all - and
  // then the positive half of the filter never gets exercised.
  const MATCH = (() => {
    const fromItems = [];
    for (const len of [4, 3, 2]) {
      for (const it of ITEMS) {
        const term = String(it).trim().toLowerCase().slice(0, len);
        if (term.length < len || !/^[a-z]+$/.test(term)) continue;
        const hits = ITEMS.filter((x) => String(x).toLowerCase().includes(term)).length;
        if (hits > 0 && hits < ITEMS.length) fromItems.push(term);
      }
    }
    return fromItems[0] || matchingTermFrom(visOf(o1));
  })();
  if (!o1 || !oNeg) whyNotFilter.push('the page as delivered could not be observed under a non-matching term');
  else if (ITEMS.length < 2) whyNotFilter.push(`typing ${JSON.stringify(NON_MATCHING)} hid ${ITEMS.length} of the visible texts, too few to call a governed set`);
  else if (!MATCH) whyNotFilter.push(`no term taken from the ${ITEMS.length} governed items separates them, so ${SEL} cannot be exercised positively`);
  else {
    // STEP THREE: type it, and let the PAGE say what it matches. The term is chosen by its text, but the
    // expectation recorded is what the delivered page actually shows - its filter may match by prefix,
    // by case, or by something else entirely, and preservation means preserving what is there.
    const pos = await runSpec({
      entry: 'index.html', stateExpr: STATE_EXPR, contract: 'establish what the term matches',
      steps: [
        { n: 1, name: 'matching', do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: 'false' },
      ],
    });
    const oPos = obsOf(pos, 1);
    const MATCHED = visOf(oPos).filter((t) => ITEMS.includes(t));
    const CONTROL = CONTROLS.find((s) => !html.includes(s.slice(1)));
    if (!oPos) whyNotFilter.push(`the page could not be observed under ${JSON.stringify(MATCH)}`);
    else if (!MATCHED.length) whyNotFilter.push(`${JSON.stringify(MATCH)} matched none of the ${ITEMS.length} governed items, so only the negative half of the filter can be exercised`);
    else if (MATCHED.length === ITEMS.length) whyNotFilter.push(`${JSON.stringify(MATCH)} matched all ${ITEMS.length} governed items, so a check using it could not tell filtering from doing nothing`);
    else if (!CONTROL) whyNotFilter.push('every candidate control id already appears somewhere in the page');
    else filter = { SEL, MATCH, ITEMS, MATCHED, CONTROL };
  }
}

let steps; let carried; let addition; let noErr; let requirement; let goal; let branch; let branchWhy;

if (filter) {
  // ══ FILTER: the addition is a control that clears the filter ═══════════════════════════════════
  const { SEL, MATCH, ITEMS, MATCHED, CONTROL } = filter;
  branch = 'FILTER';
  branchWhy = [
    `typing into ${SEL} was confirmed to change what the page shows`,
    `typing ${JSON.stringify(NON_MATCHING)} hid ${ITEMS.length} visible texts, and that is the set the filter governs`,
    `typing ${JSON.stringify(MATCH)} left ${MATCHED.length} of those ${ITEMS.length} visible, so a check using it can tell filtering from doing nothing`,
    `${CONTROL} appears nowhere in the page, so the requirement asks for something that does not exist yet`,
  ];
  // Every list expectation reads ONLY the governed items, so the control the addition adds - new visible
  // text, correctly - cannot fail a preservation check.
  const only = `dom.visible.filter((t) => ${JSON.stringify(ITEMS)}.includes(t))`;
  const ALL = J(ITEMS);
  const SOME = J(MATCHED);
  steps = [
    // carried forward, from OBSERVATION of the delivered page
    { n: 1, name: 'loads with no page or console error, showing every item', do: [], expect: `errors.length === 0 && JSON.stringify(${only}) === ${ALL}` },
    { n: 2, name: `typing ${JSON.stringify(MATCH)} narrows the list as it already does`, do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: `JSON.stringify(${only}) === ${SOME}` },
    // the addition, from the frozen requirement - two effects, two separately stated expectations
    { n: 3, name: `clicking ${CONTROL} brings every item back`, do: [{ kind: 'click', selector: CONTROL }], expect: `JSON.stringify(${only}) === ${ALL}` },
    { n: 4, name: `and leaves ${SEL} empty`, do: [], expect: `dom.inputValues[${JSON.stringify(SEL)}] === ''` },
    // the invariant, exercised in the addition's own context
    { n: 5, name: 'filtering still narrows the list afterwards', do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: `JSON.stringify(${only}) === ${SOME}` },
    { n: 6, name: `clicking ${CONTROL} a second time brings every item back again`, do: [{ kind: 'click', selector: CONTROL }], expect: `JSON.stringify(${only}) === ${ALL}` },
    { n: 7, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' },
  ];
  // 5 is deliberately NOT in the addition set: typing still narrows on the DELIVERED page, so it passes
  // there and cannot be evidence that the addition is absent. It is a preservation obligation, and it is
  // carried forward as one.
  carried = [1, 2, 5, 7];
  addition = [3, 4, 6];
  noErr = 7;
  requirement = {
    trigger: { kind: 'click', selector: CONTROL },
    effects: [`${SEL} is empty`, 'every item in the list is visible again'],
    invariants: ['typing in the filter still narrows the list'],
  };
  goal = `Continue the page already in index.html. Add a control ${CONTROL} that clears the filter: clicking it empties ${SEL} and shows every item in the list again. Typing in the filter must still narrow the list. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML and JavaScript, no frameworks, no external files or CDNs.`;
} else {
  // ══ KEY: unchanged. A free trigger key returns the page to its load state ══════════════════════
  branch = 'KEY';
  branchWhy = whyNotFilter;
  const keysUsed = new Set(confirmed.filter((c) => c.kind === 'key').map((c) => c.key));
  const TRIGGER = TRIGGERS.find((k) => !keysUsed.has(k));
  if (!TRIGGER) { console.error('NOT EMITTED: no free trigger key'); process.exit(6); }
  const probe = await runSpec({
    entry: 'index.html', stateExpr: STATE_EXPR, contract: 'observed',
    steps: [
      { n: 1, name: 'load', do: [], expect: 'false' },
      ...chosen.map((c, i) => ({ n: i + 2, name: describeAction(c), do: [act(c)], expect: 'false' })),
    ],
  });
  const loadObs = obsOf(probe, 1);
  if (!loadObs) { console.error('NOT EMITTED: the load observation could not be read'); process.exit(7); }
  steps = [{ n: 1, name: 'loads with no page or console error, in its starting state', do: [], expect: `errors.length === 0 && JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` }];
  let n = 2;
  carried = [1];
  for (const c of chosen) {
    steps.push({ n, name: `${describeAction(c)} produces the result it already produces`, do: [act(c)], expect: `JSON.stringify(dom.visible) === ${J(visOf(obsOf(probe, n)))}` });
    carried.push(n);
    n++;
  }
  const addStart = n;
  steps.push({ n: n++, name: `pressing ${TRIGGER} returns the visible result to its starting state`, do: [{ kind: 'key', key: TRIGGER }], expect: `JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` });
  steps.push({ n: n++, name: `pressing ${TRIGGER} again leaves it at the starting state`, do: [{ kind: 'key', key: TRIGGER }], expect: `JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` });
  addition = [addStart, addStart + 1];
  steps.push({ n, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' });
  carried.push(n);
  noErr = n;
  requirement = {
    trigger: { kind: 'key', key: TRIGGER },
    effects: ['the page shows what it showed when it first loaded'],
    invariants: ['everything that already works keeps working'],
  };
  goal = `Continue the page already in index.html. Pressing ${TRIGGER} returns the page to the state it shows when it first loads. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML and JavaScript, no frameworks, no external files or CDNs.`;
}

const spec = { entry: 'index.html', stateExpr: STATE_EXPR, contract: 'The visible result is the evidence; a state accessor is used only when the page exposes one.', steps };

// ── validate on the baseline: carried-forward must pass, the addition must be absent ──
const base = await runSpec(spec);
const passing = [...(base.passing || [])].sort((a, b) => a - b);
const failing = [...(base.failing || [])].sort((a, b) => a - b);
const carriedOk = carried.every((x) => passing.includes(x));
const additionAbsent = addition.every((x) => failing.includes(x));
console.log(`confirmed       ${chosen.map((c) => describeAction(c)).join('; ')}`);
console.log(`addition rule   ${branch}`);
for (const w of branchWhy) console.log(`                ${w}`);
console.log(`baseline        passing [${passing.join(',')}]  failing [${failing.join(',')}]`);
console.log(`  carried-forward passes : ${carriedOk}  (steps ${carried.join(',')})`);
console.log(`  addition is ABSENT     : ${additionAbsent}  (steps ${addition.join(',')})`);
for (const c of (base.cases || [])) if (c.kind !== 'PASS') console.log(`    ${c.kind} ${c.n}: ${String(c.text).slice(0, 120)}`);
if (!carriedOk || !additionAbsent) { console.error('\nNOT EMITTED: a task needs its carried-forward checks passing AND its addition absent'); process.exit(8); }

const sub = (ns) => ({ ...spec, name: `steps-${ns.join('')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) });
const all = steps.map((s) => s.n);
const task = {
  id: `auto-${DIR.split(/[\\/]/).filter(Boolean).pop()}`, group: 'AUTO', source: 'internal', language: 'javascript', kind: 'build',
  dependsOn: null,
  goal,
  requirement,
  seed: {},
  requested: { play: { spec: sub(all), steps: all } },
  accumulates: ['the page as delivered'],
  supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec: sub(carried), steps: carried }] },
  diagnostic: { kind: 'play', spec: sub(all), timeoutSec: 90 },
  upstreamCases: all.length, protectedCases: carried.length,
  // WHAT THE BASELINE RUN ESTABLISHED, AND WHAT IT DID NOT. Two NECESSARY conditions were checked. They
  // are not sufficient, and calling them "the task is validated" would overstate them by a long way.
  validation: {
    checked: [
      'every carried-forward check PASSES on the page as delivered',
      'every addition check FAILS on the page as delivered, so the addition is genuinely absent',
    ],
    notEstablished: [
      'that the carried-forward checks encode INTENDED behaviour. They are PROPOSED preservation, derived from observing what the page does; a defect present in the delivered page becomes a check that protects the defect. Only a requirement can say which it is, and none was consulted.',
      'that the requested and the protected sets are mutually consistent. A requirement contradicting a preserved behaviour passes both conditions above and only fails later, as a candidate that cannot satisfy both.',
    ],
  },
  observation: {
    outcome: sel.outcome,
    selectedAdapters: sel.selected.map((s) => s.adapterId),
    why: sel.selected.map((s) => s.why),
    confirmedInteractions: chosen.map((c) => describeAction(c)),
    coverageLimits: sel.coverageLimits,
    unresolved: sel.unresolved,
    additionRule: branch,
    additionRuleWhy: branchWhy,
    note: branch === 'FILTER'
      ? 'the addition is click-triggered because typing was confirmed to govern a set of items; its two effects are checked separately, and every list check is scoped to the governed items so the new control cannot fail a preservation check'
      : 'the carried-forward checks use the modality the page responds to; the addition is key-triggered because no filter-like behaviour was confirmed',
  },
  provenance: {
    baselineSha: sha(html), carriedSteps: carried, additionSteps: addition, noErrorStep: noErr,
    ...(filter
      ? { control: filter.CONTROL, field: filter.SEL, matchingTerm: filter.MATCH, nonMatchingTerm: NON_MATCHING, governedItems: filter.ITEMS, matchedItems: filter.MATCHED }
      : { trigger: requirement.trigger.key }),
    emittedAt: new Date().toISOString(),
  },
};
writeFileSync(join(DIR, 'play.json'), JSON.stringify(spec, null, 2) + NL, 'utf8');
writeFileSync(join(DIR, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`\nEMITTED ${join(DIR, 'task.json')}   ${branch} rule, carried-forward ${carried.length} checks, addition ${addition.length} checks`);
