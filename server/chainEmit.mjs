#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// chainEmit.mjs — AUDIT-2 stage 4. Emit generation N of an ACCUMULATING chain of requirements.
//
//   node server/chainEmit.mjs --dir <page dir> --generation 2
//
// Stage 3 asked "can you make this change?" and a 7B answered yes six times out of six by rewriting
// the page. That is not the proposition Legasus exists for. This is:
//
//   state0 + A -> state1
//   state1 + B -> state2, which must STILL satisfy A
//   state2 + C -> state3, which must STILL satisfy A and B
//
// A whole-page generator gets a fresh opportunity to disturb established behaviour on every
// generation. A bounded editor may get fewer. THAT IS A HYPOTHESIS, not an entitlement, and the only
// thing that settles it is measuring both.
//
// THE MEASUREMENT is not "did the newest addition work". It is
//
//   P(the new requirement passes AND every prior requirement still passes)
//
// recorded per generation, so the object is the SHAPE of the curve rather than one endpoint.
//
// THE LADDER is fixed in advance and page-independent. Each rung is checked for ABSENCE on the page as
// it currently stands, exactly as the stage-3 emitter checks its single addition: a requirement that
// already holds is not an addition, which is the defect page e2 exposed and which is recorded rather
// than worked around.
//
//   G1  a #clear-filter control: clicking it empties the field and shows every governed item
//   G2  a free trigger key: pressing it returns the visible result to its load state
//   G3  a #match-count element: it shows how many governed items are currently visible
//
// Every generation carries EVERY earlier generation's checks forward as protected obligations, along
// with the original observed behaviour. The protected set only grows.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const NAME = opt('name', 'baseline-as-delivered.html');
const GEN = parseInt(opt('generation', '1'), 10);
if (!DIR) { console.error('usage: node server/chainEmit.mjs --dir <page dir> --generation <n>'); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
// THE TRIGGER MUST BE NON-PRINTING. On a page whose filter field has focus - which is exactly where
// this ladder leaves it, because the setup step types into it - pressing 0 or z INSERTS THAT
// CHARACTER. The handler runs, clears the field, and the keystroke is then written into it, so the
// trigger and the filter fight and the requirement is unsatisfiable by construction. Escape carries
// no character. The stage-3 emitter has the same latent issue and it never bit there, because its
// KEY pages have no focused text field; recorded, not fixed mid-audit.
const TRIGGERS = ['Escape'];
const CONTROLS = ['#clear-filter', '#reset-filter', '#clear-all'];
const COUNTERS = ['#match-count', '#visible-count', '#shown-count'];

const { selectObservation } = await import('./observationSelect.mjs');
const { playCheck } = await import('./playCheck.js');
const { matchingTermFrom, NON_MATCHING } = await import('./adapters/browser.mjs');

const html = readFileSync(join(DIR, NAME), 'utf8');
const runSpec = async (spec) => {
  const w = mkdtempSync(join(tmpdir(), 'chain-'));
  try { writeFileSync(join(w, 'index.html'), html, 'utf8'); return await playCheck(w, spec); }
  finally { if (existsSync(w)) { try { rmSync(w, { recursive: true, force: true }); } catch { /* best effort */ } } }
};
const STATE_EXPR = 'window.app && window.app.state ? window.app.state() : null';
const J = (v) => JSON.stringify(JSON.stringify(v));
const visOf = (o) => (o ? o.visible : []);
const hidOf = (o) => (o ? (o.hidden || []) : []);
const obsOf = (run, n) => { const c = ((run && run.cases) || []).find((x) => x.n === n); return c && c.observed ? c.observed : null; };

// ── the filter facts, established on the page AS IT NOW STANDS ──
const ws = mkdtempSync(join(tmpdir(), 'chainobs-'));
let sel;
try { writeFileSync(join(ws, 'index.html'), html, 'utf8'); sel = await selectObservation(ws); }
finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
if (!sel.ok || sel.outcome !== 'CONFIRMED_BEHAVIOUR') {
  console.error(`NOT EMITTED: observation is ${sel.ok ? sel.outcome : sel.reason}`);
  process.exit(4);
}
const confirmed = [];
for (const p of sel.probes) for (const e of (p.effective || [])) confirmed.push({ ...e.interaction, adapterId: p.adapterId });
const typed = confirmed.find((c) => c.kind === 'type');
if (!typed) { console.error('NOT EMITTED: this chain needs a filter field, and none was confirmed'); process.exit(5); }

const SEL = typed.selector;
const neg = await runSpec({
  entry: 'index.html', stateExpr: STATE_EXPR, contract: 'governed set',
  steps: [{ n: 1, name: 'load', do: [], expect: 'false' },
    { n: 2, name: 'nonmatching', do: [{ kind: 'type', selector: SEL, text: NON_MATCHING }], expect: 'false' }],
});
const atLoad = obsOf(neg, 1);
const gone = new Set(hidOf(obsOf(neg, 2)));
const ITEMS = visOf(atLoad).filter((t) => gone.has(t));
const MATCH = (() => {
  for (const len of [4, 3, 2]) {
    for (const it of ITEMS) {
      const term = String(it).trim().toLowerCase().slice(0, len);
      if (term.length < len || !/^[a-z]+$/.test(term)) continue;
      const hits = ITEMS.filter((x) => String(x).toLowerCase().includes(term)).length;
      if (hits > 0 && hits < ITEMS.length) return term;
    }
  }
  return matchingTermFrom(visOf(atLoad));
})();
if (ITEMS.length < 2 || !MATCH) { console.error(`NOT EMITTED: ${ITEMS.length} governed items, term ${JSON.stringify(MATCH)}`); process.exit(6); }
const pos = await runSpec({
  entry: 'index.html', stateExpr: STATE_EXPR, contract: 'what the term matches',
  steps: [{ n: 1, name: 'matching', do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: 'false' }],
});
const MATCHED = visOf(obsOf(pos, 1)).filter((t) => ITEMS.includes(t));
if (!MATCHED.length || MATCHED.length === ITEMS.length) { console.error(`NOT EMITTED: ${JSON.stringify(MATCH)} matched ${MATCHED.length} of ${ITEMS.length}`); process.exit(7); }

const only = `dom.visible.filter((t) => ${JSON.stringify(ITEMS)}.includes(t))`;
const ALL = J(ITEMS);
const SOME = J(MATCHED);
const keysUsed = new Set(confirmed.filter((c) => c.kind === 'key').map((c) => c.key));
// THE NAMES ARE FIXED, NOT CHOSEN FRESH EACH GENERATION. Picking the first UNUSED name was a defect
// that would have silently destroyed the measurement: once generation 1 added #clear-filter, that
// name was in the page, so generation 2 chose #reset-filter and restated generation 1 obligation
// against a selector that does not exist - reporting a regression the arm never caused. An
// obligation must keep the name it was established under. Whether the name is free is settled by the
// addition-absence check below, which is the same guard the stage-3 emitter uses.
const CONTROL = CONTROLS[0];
const TRIGGER = TRIGGERS[0];
const COUNTER = COUNTERS[0];

// ── THE LADDER. Each rung's steps, and the requirement that produces them. ──
const LOAD = J(visOf(atLoad));
const ladder = [
  {
    n: 1, name: 'clear-filter control',
    requirement: { trigger: { kind: 'click', selector: CONTROL }, effects: [`${SEL} is empty`, 'every item in the list is visible again'], invariants: ['typing in the filter still narrows the list'] },
    goal: `Add a control ${CONTROL} that clears the filter: clicking it empties ${SEL} and shows every item in the list again.`,
    steps: (b) => [
      // SETUP steps establish the state the addition is asked about. They describe EXISTING
      // behaviour, so they pass on the page as it stands and belong with the carried obligations.
      // Counting one as an addition is what made the first version of this ladder refuse to emit.
      { role: 'setup', n: b, name: `typing ${JSON.stringify(MATCH)} narrows the list`, do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: `JSON.stringify(${only}) === ${SOME}` },
      { role: 'addition', n: b + 1, name: `clicking ${CONTROL} brings every item back`, do: [{ kind: 'click', selector: CONTROL }], expect: `JSON.stringify(${only}) === ${ALL}` },
      { role: 'addition', n: b + 2, name: `and leaves ${SEL} empty`, do: [], expect: `dom.inputValues[${JSON.stringify(SEL)}] === ''` },
    ],
  },
  {
    n: 2, name: 'reset key',
    requirement: { trigger: { kind: 'key', key: TRIGGER }, effects: ['every item in the list is visible again'], invariants: ['the clear control still works', 'typing in the filter still narrows the list'] },
    goal: `Pressing ${TRIGGER} shows every item in the list again, whatever the filter currently holds.`,
    steps: (b) => [
      { role: 'setup', n: b, name: `typing ${JSON.stringify(MATCH)} narrows the list`, do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: `JSON.stringify(${only}) === ${SOME}` },
      { role: 'addition', n: b + 1, name: `pressing ${TRIGGER} brings every item back`, do: [{ kind: 'key', key: TRIGGER }], expect: `JSON.stringify(${only}) === ${ALL}` },
    ],
  },
  {
    n: 3, name: 'match count',
    requirement: { trigger: { kind: 'type', selector: SEL }, effects: [`${COUNTER} shows how many items are visible`], invariants: ['the clear control still works', 'typing in the filter still narrows the list'] },
    goal: `Add an element ${COUNTER} whose text is the NUMBER of list items currently visible, updated whenever the filter changes.`,
    steps: (b) => [
      { role: 'addition', n: b, name: `${COUNTER} shows ${ITEMS.length} at load`, do: [], expect: `(dom.visible.join(' ').match(/(^|[^0-9])${ITEMS.length}([^0-9]|$)/) !== null)` },
      { role: 'addition', n: b + 1, name: `typing ${JSON.stringify(MATCH)} makes it show ${MATCHED.length}`, do: [{ kind: 'type', selector: SEL, text: MATCH }], expect: `(dom.visible.join(' ').match(/(^|[^0-9])${MATCHED.length}([^0-9]|$)/) !== null)` },
    ],
  },
];
if (GEN < 1 || GEN > ladder.length) { console.error(`NOT EMITTED: generation ${GEN} is outside the ladder of ${ladder.length}`); process.exit(8); }


// ── the ORIGINAL observed behaviour, always carried ──
const base = [
  { n: 1, name: 'loads with no page or console error, showing every item', do: [], expect: `errors.length === 0 && JSON.stringify(${only}) === ${ALL}` },
];
let next = 2;
const generations = [];
for (let g = 1; g <= GEN; g++) {
  const rung = ladder[g - 1];
  const steps = rung.steps(next);
  generations.push({
    generation: g, name: rung.name, rung,
    steps: steps.map((s) => s.n),
    setupSteps: steps.filter((s) => s.role === 'setup').map((s) => s.n),
    additionSteps: steps.filter((s) => s.role === 'addition').map((s) => s.n),
  });
  next += steps.length;
  base.push(...steps);
}
const NOERR = next;
base.push({ n: NOERR, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' });

const spec = { entry: 'index.html', stateExpr: STATE_EXPR, contract: 'accumulating obligations', steps: base };
const thisGen = generations[GEN - 1];
const priorSteps = generations.slice(0, GEN - 1).flatMap((x) => x.steps);
// This generation's own SETUP steps are carried too: they assert behaviour the page already has,
// and requiring them to fail would make every generation unemittable.
const carried = [1, ...priorSteps, ...thisGen.setupSteps, NOERR].sort((a, b) => a - b);
const addition = thisGen.additionSteps;

// ── validate: every carried obligation passes NOW, and this generation's addition is ABSENT ──
const run = await runSpec(spec);
const passing = [...(run.passing || [])].sort((a, b) => a - b);
const failing = [...(run.failing || [])].sort((a, b) => a - b);
const carriedOk = carried.every((x) => passing.includes(x));
const additionAbsent = addition.every((x) => failing.includes(x));
console.log(`generation      ${GEN} of ${ladder.length} - ${thisGen.name}`);
console.log(`governed items  ${ITEMS.length}, term ${JSON.stringify(MATCH)} matches ${MATCHED.length}`);
console.log(`carried         ${carried.join(',')}  addition ${addition.join(',')}`);
console.log(`baseline        passing [${passing.join(',')}] failing [${failing.join(',')}]`);
console.log(`  every prior obligation still passes : ${carriedOk}`);
console.log(`  this generation's addition is ABSENT: ${additionAbsent}`);
for (const c of (run.cases || [])) if (c.kind !== 'PASS') console.log(`    ${c.kind} ${c.n}: ${String(c.text).slice(0, 200)}`);
if (!carriedOk || !additionAbsent) {
  console.error(`${NL}NOT EMITTED: a generation needs every accumulated obligation passing AND its own addition absent`);
  process.exit(10);
}

const sub = (ns) => ({ ...spec, name: `g${GEN}-${ns.join('')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) });
const all = base.map((s) => s.n);
const task = {
  id: `chain-${DIR.split(/[\\/]/).filter(Boolean).pop()}-g${GEN}`, group: 'CHAIN', source: 'internal', language: 'javascript', kind: 'build',
  generation: GEN, generationName: thisGen.name, ladderLength: ladder.length,
  goal: `${thisGen.rung.goal} Everything the page already does must keep working. The page is a single self-contained web page, index.html: plain HTML and JavaScript, no frameworks, no external files or CDNs.`,
  requirement: thisGen.rung.requirement,
  seed: {},
  requested: { play: { spec: sub(all), steps: all } },
  accumulates: generations.slice(0, GEN - 1).map((x) => x.name),
  supersedes: [],
  protected: { plays: [{ from: `the page after generation ${GEN - 1}`, spec: sub(carried), steps: carried }] },
  diagnostic: { kind: 'play', spec: sub(all), timeoutSec: 120 },
  upstreamCases: all.length, protectedCases: carried.length,
  observation: { outcome: sel.outcome, selectedAdapters: sel.selected.map((s) => s.adapterId), coverageLimits: sel.coverageLimits, unresolved: sel.unresolved },
  provenance: {
    baselineSha: sha(html), carriedSteps: carried, additionSteps: addition, noErrorStep: NOERR,
    governedItems: ITEMS, matchedItems: MATCHED, matchingTerm: MATCH, field: SEL,
    control: CONTROL, trigger: TRIGGER, counter: COUNTER,
    priorGenerations: generations.slice(0, GEN - 1).map((x) => ({ generation: x.generation, name: x.name, steps: x.steps })),
    emittedAt: new Date().toISOString(),
  },
};
writeFileSync(join(DIR, 'play.json'), JSON.stringify(spec, null, 2) + NL, 'utf8');
writeFileSync(join(DIR, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`${NL}EMITTED generation ${GEN}: ${carried.length} accumulated obligations, ${addition.length} new checks`);
