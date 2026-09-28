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
//     from OBSERVATION - the confirmed interactions and the result they produced. Preserving behaviour
//     means preserving what is there, bugs included.
//   the ADDITION's checks come from the frozen REQUIREMENT, never from the candidate. They cannot come
//     from observation because the behaviour does not exist yet, and on the baseline they must FAIL.
//
// THE ADDITION RULE, page-independent and fixed in advance:
//   pressing a free trigger key returns the application to the observable state it had at load.
// The trigger is a KEY even on an input-driven page, because that is the edit shape the guidance policy
// supports; the carried-forward checks use whatever modality the page actually responds to. That
// asymmetry is deliberate and is recorded in the task.
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

const { selectObservation } = await import('./observationSelect.mjs');
const { playCheck } = await import('./playCheck.js');
const { describe: describeAction } = await import('./actions.mjs');

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

// ── a free trigger key: one the page does not already respond to ──
const keysUsed = new Set(confirmed.filter((c) => c.kind === 'key').map((c) => c.key));
const TRIGGER = TRIGGERS.find((k) => !keysUsed.has(k));
if (!TRIGGER) { console.error('NOT EMITTED: no free trigger key'); process.exit(6); }

// ── replay the chosen interactions once, to record what they produce ──
const act = (i) => ({ kind: i.kind, key: i.key, selector: i.selector, text: i.text });
const probeSpec = {
  entry: 'index.html', stateExpr: 'window.app && window.app.state ? window.app.state() : null', contract: 'observed',
  steps: [
    { n: 1, name: 'load', do: [], expect: 'false' },
    ...chosen.map((c, i) => ({ n: i + 2, name: describeAction(c), do: [act(c)], expect: 'false' })),
  ],
};
const runSpec = async (spec) => {
  const w = mkdtempSync(join(tmpdir(), 'emitrun-'));
  try { writeFileSync(join(w, 'index.html'), html, 'utf8'); return await playCheck(w, spec); }
  finally { if (existsSync(w)) { try { rmSync(w, { recursive: true, force: true }); } catch { /* best effort */ } } }
};
const seen = await runSpec(probeSpec);
const observedAt = (n) => {
  const c = (seen.cases || []).find((x) => x.n === n);
  return c && c.observed ? c.observed : null;
};
const loadObs = observedAt(1);
if (!loadObs) { console.error('NOT EMITTED: the load observation could not be read'); process.exit(7); }

const J = (v) => JSON.stringify(JSON.stringify(v));
const visOf = (o) => (o ? o.visible : []);

// ── the CARRIED-FORWARD steps: what it already does, from observation ──
const steps = [{ n: 1, name: 'loads with no page or console error, in its starting state', do: [], expect: `errors.length === 0 && JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` }];
let n = 2;
const carried = [1];
for (const c of chosen) {
  const o = observedAt(n);
  steps.push({ n, name: `${describeAction(c)} produces the result it already produces`, do: [act(c)], expect: `JSON.stringify(dom.visible) === ${J(visOf(o))}` });
  carried.push(n);
  n++;
}
// ── the ADDITION steps: from the frozen rule, never from the page ──
const addStart = n;
steps.push({ n: n++, name: `pressing ${TRIGGER} returns the visible result to its starting state`, do: [{ kind: 'key', key: TRIGGER }], expect: `JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` });
steps.push({ n: n++, name: `pressing ${TRIGGER} again leaves it at the starting state`, do: [{ kind: 'key', key: TRIGGER }], expect: `JSON.stringify(dom.visible) === ${J(visOf(loadObs))}` });
const addition = [addStart, addStart + 1];
steps.push({ n, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' });
carried.push(n);
const noErr = n;

const spec = { entry: 'index.html', stateExpr: 'window.app && window.app.state ? window.app.state() : null', contract: 'The visible result is the evidence; a state accessor is used only when the page exposes one.', steps };

// ── validate on the baseline: carried-forward must pass, the addition must be absent ──
const base = await runSpec(spec);
const passing = [...(base.passing || [])].sort((a, b) => a - b);
const failing = [...(base.failing || [])].sort((a, b) => a - b);
const carriedOk = carried.every((x) => passing.includes(x));
const additionAbsent = addition.every((x) => failing.includes(x));
console.log(`confirmed       ${chosen.map((c) => describeAction(c)).join('; ')}`);
console.log(`trigger         '${TRIGGER}' (free)`);
console.log(`baseline        passing [${passing.join(',')}]  failing [${failing.join(',')}]`);
console.log(`  carried-forward passes : ${carriedOk}`);
console.log(`  addition is ABSENT     : ${additionAbsent}`);
for (const c of (base.cases || [])) if (c.kind !== 'PASS') console.log(`    ${c.kind} ${c.n}: ${String(c.text).slice(0, 120)}`);
if (!carriedOk || !additionAbsent) { console.error('\nNOT EMITTED: a task needs its carried-forward checks passing AND its addition absent'); process.exit(8); }

const sub = (ns) => ({ ...spec, name: `steps-${ns.join('')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) });
const all = steps.map((s) => s.n);
const task = {
  id: `auto-${DIR.split(/[\\/]/).filter(Boolean).pop()}`, group: 'AUTO', source: 'internal', language: 'javascript', kind: 'build',
  dependsOn: null,
  goal: `Continue the page already in index.html. Pressing ${TRIGGER} returns the page to the state it shows when it first loads. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML and JavaScript, no frameworks, no external files or CDNs.`,
  requirement: {
    trigger: { kind: 'key', key: TRIGGER },
    effects: ['the page shows what it showed when it first loaded'],
    invariants: ['everything that already works keeps working'],
  },
  seed: {},
  requested: { play: { spec: sub(all), steps: all } },
  accumulates: ['the page as delivered'],
  supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec: sub(carried), steps: carried }] },
  diagnostic: { kind: 'play', spec: sub(all), timeoutSec: 90 },
  upstreamCases: all.length, protectedCases: carried.length,
  observation: {
    outcome: sel.outcome,
    selectedAdapters: sel.selected.map((s) => s.adapterId),
    why: sel.selected.map((s) => s.why),
    confirmedInteractions: chosen.map((c) => describeAction(c)),
    coverageLimits: sel.coverageLimits,
    unresolved: sel.unresolved,
    note: 'the carried-forward checks use the modality the page responds to; the addition is key-triggered because that is the edit shape the guidance policy supports',
  },
  provenance: { baselineSha: sha(html), trigger: TRIGGER, carriedSteps: carried, additionSteps: addition, noErrorStep: noErr, emittedAt: new Date().toISOString() },
};
writeFileSync(join(DIR, 'play.json'), JSON.stringify(spec, null, 2) + NL, 'utf8');
writeFileSync(join(DIR, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`\nEMITTED ${join(DIR, 'task.json')}   carried-forward ${carried.length} checks via ${[...new Set(chosen.map((c) => c.kind))].join('/')}, addition via key '${TRIGGER}'`);
