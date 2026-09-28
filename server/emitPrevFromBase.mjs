#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// emitPrevFromBase.mjs — describe a page's EXISTING behaviour as a "previous addition" task.
//
//   node server/emitPrevFromBase.mjs --dir <page dir> --out <dir> --reset-key 0
//
// Needed for a hand-written regression subject that ALREADY HAS the earlier feature. `emitTask` refuses
// to emit a task whose addition is already present - correctly - so this instead records what the page
// does today as the carried-forward set that the NEXT addition must preserve.
//
// Every expectation is taken from OBSERVATION of the page, and the emitter refuses unless all of them
// pass on it. It describes; it does not require.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const OUT = opt('out', null);
const RESET = opt('reset-key', '0');
const KEY = opt('key', 'a');
const NAME = opt('name', 'baseline-as-delivered.html');
if (!DIR || !OUT) { console.error('usage: node server/emitPrevFromBase.mjs --dir <page dir> --out <dir> [--reset-key 0] [--key a]'); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const { observe } = await import('./observeState.mjs');
const { playCheck } = await import('./playCheck.js');

const html = readFileSync(join(DIR, NAME), 'utf8');
const ws = mkdtempSync(join(tmpdir(), 'prev-'));
let obs;
try {
  writeFileSync(join(ws, 'index.html'), html, 'utf8');
  obs = await observe(ws, { keys: [KEY, KEY, RESET, KEY] });
  if (!obs.ok) { console.error(`could not observe: ${obs.reason}`); process.exit(3); }
} finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }

const J = (v) => JSON.stringify(JSON.stringify(v));
const load = obs.atLoad.value;
const a1 = obs.observations[1].value, a2 = obs.observations[2].value;
const afterReset = obs.observations[3].value, afterKey = obs.observations[4].value;

const steps = [
  { n: 1, name: 'loads with no page or console error, in its starting state', do: [], expect: `errors.length === 0 && JSON.stringify(state) === ${J(load)}` },
  { n: 2, name: `pressing ${KEY} changes the state as it already did`, do: [{ key: KEY }], expect: `JSON.stringify(state) === ${J(a1)}` },
  { n: 3, name: `pressing ${KEY} again changes it again`, do: [{ key: KEY }], expect: `JSON.stringify(state) === ${J(a2)}` },
  { n: 4, name: `pressing ${RESET} returns every piece of state to its starting value`, do: [{ key: RESET }], expect: `JSON.stringify(state) === ${J(afterReset)}` },
  { n: 5, name: `pressing ${KEY} still works after ${RESET}`, do: [{ key: KEY }], expect: `JSON.stringify(state) === ${J(afterKey)}` },
  { n: 6, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' },
];
const spec = { entry: 'index.html', stateExpr: 'window.app.state()', contract: 'The page must expose window.app.state() returning every piece of state it keeps.', steps };

const ws2 = mkdtempSync(join(tmpdir(), 'prevc-'));
let run;
try { writeFileSync(join(ws2, 'index.html'), html, 'utf8'); run = await playCheck(ws2, spec); }
finally { if (existsSync(ws2)) { try { rmSync(ws2, { recursive: true, force: true }); } catch { /* best effort */ } } }
const passing = [...(run.passing || [])].sort((x, y) => x - y);
console.log(`base            ${join(DIR, NAME)}   sha ${sha(html).slice(0, 16)}`);
console.log(`load state      ${JSON.stringify(load)}`);
console.log(`observed        ${KEY}->${JSON.stringify(a1)} ${KEY}->${JSON.stringify(a2)} ${RESET}->${JSON.stringify(afterReset)} ${KEY}->${JSON.stringify(afterKey)}`);
console.log(`describes the page: passing [${passing.join(',')}] of ${steps.length}`);
if (passing.length !== steps.length) {
  for (const c of run.cases || []) if (c.kind !== 'PASS') console.log(`    FAIL ${c.n}: ${String(c.text).slice(0, 140)}`);
  console.error('NOT EMITTED: a description of the page must pass on the page');
  process.exit(4);
}
if (JSON.stringify(afterReset) !== JSON.stringify(load)) {
  console.error(`NOT EMITTED: pressing '${RESET}' did not return the state to its load value, so this page does not have the earlier feature`);
  process.exit(5);
}

const all = steps.map((s) => s.n);
const task = {
  id: `prev-${DIR.split(/[\\/]/).filter(Boolean).pop()}`, group: 'PREV', source: 'description', language: 'javascript', kind: 'build',
  dependsOn: null,
  goal: 'the page as delivered, including the feature it already has',
  requirement: { trigger: { kind: 'key', key: RESET }, effects: ['every piece of state is back to its starting value'], invariants: [`the ${KEY} key keeps working`] },
  seed: {},
  requested: { play: { spec, steps: all } },
  accumulates: ['the page as delivered'],
  supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec, steps: all }] },
  diagnostic: { kind: 'play', spec, timeoutSec: 90 },
  upstreamCases: all.length, protectedCases: all.length,
  provenance: { baseSha: sha(html), describedNotRequired: true, loadState: load, emittedAt: new Date().toISOString() },
};
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`\nEMITTED ${join(OUT, 'task.json')}   ${all.length} checks describing the page as it is`);
