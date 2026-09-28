#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// emitTask.mjs — build the task and its checks MECHANICALLY from what the page was observed to do.
//
//   node server/emitTask.mjs --dir legasus/bench/set3/s3-04-colour
//
// The addition rule is fixed in TRANSFER-3's definition: pressing the free trigger key returns every
// piece of state to its load value, and the existing controls keep working afterwards. Nothing here is
// chosen per page.
//
// TWO SOURCES, KEPT APART:
//   the EXISTING behaviour steps take their expected values from OBSERVATION - what the page actually
//   did when the key was pressed. They describe the page as delivered.
//   the ADDITION steps take their expected values from THE RULE - equality with the load state. They
//   cannot come from observation, because the behaviour does not exist yet; and on the baseline they
//   must FAIL, which is checked before the task is emitted.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const NAME = opt('name', 'baseline-as-delivered.html');
if (!DIR) { console.error('usage: node server/emitTask.mjs --dir <dir> [--name <file>]'); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const { observe, respondingKeys } = await import('./observeState.mjs');
const { PROBE_KEYS, RESET_KEY_CANDIDATES, parseCheck, generationFacts, probe, eligibility } = await import('./sealedPage.mjs');

const file = join(DIR, NAME);
const html = readFileSync(file, 'utf8');

// Re-confirm eligibility here: a task must never be emitted for a page that does not qualify.
const pr = await probe(html);
const v = eligibility({ gen: generationFacts(DIR), parses: parseCheck(html), pr });
if (!v.eligible) { console.error(`this page is INELIGIBLE: ${v.fails.join('; ')}`); process.exit(3); }
const TRIGGER = v.trigger;
const existing = pr.respondsExisting;

// The key sequence the checks will use: two presses of the first responding key to move the state away
// from its load value, then the trigger twice, then the responding key again.
const K = existing[0];
const seq = [K, K, TRIGGER, TRIGGER, K];
const ws = mkdtempSync(join(tmpdir(), 'emit-'));
let obs;
try {
  writeFileSync(join(ws, 'index.html'), html, 'utf8');
  const r = await observe(ws, { keys: seq });
  if (!r.ok) { console.error(`could not observe the sequence: ${r.reason}`); process.exit(4); }
  obs = r;
} finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }

const J = (v2) => JSON.stringify(JSON.stringify(v2));      // a JS string literal of the state's JSON
const loadState = obs.atLoad.value;
const after1 = obs.observations[1].value;                  // after the first K
const after2 = obs.observations[2].value;                  // after the second K

if (JSON.stringify(after2) === JSON.stringify(loadState)) {
  console.error(`pressing ${K} twice returns to the load state, so "reset" is indistinguishable from the page's own behaviour on this page`);
  process.exit(5);
}

const steps = [
  { n: 1, name: `loads with no page or console error, in its starting state`, do: [], expect: `errors.length === 0 && JSON.stringify(state) === ${J(loadState)}` },
  { n: 2, name: `pressing ${K} changes the state as it already did`, do: [{ key: K }], expect: `JSON.stringify(state) === ${J(after1)}` },
  { n: 3, name: `pressing ${K} again changes it again`, do: [{ key: K }], expect: `JSON.stringify(state) === ${J(after2)}` },
  { n: 4, name: `pressing ${TRIGGER} returns every piece of state to its starting value`, do: [{ key: TRIGGER }], expect: `JSON.stringify(state) === ${J(loadState)}` },
  { n: 5, name: `pressing ${TRIGGER} again leaves it at the starting value`, do: [{ key: TRIGGER }], expect: `JSON.stringify(state) === ${J(loadState)}` },
  { n: 6, name: `after ${TRIGGER}, pressing ${K} still changes the state`, do: [{ key: K }], expect: `JSON.stringify(state) !== ${J(loadState)}` },
  { n: 7, name: 'no page or console error was raised at any point', do: [], expect: 'noErrors' },
];
const spec = {
  entry: 'index.html', stateExpr: 'window.app.state()',
  contract: 'The page must expose window.app.state() returning every piece of state it keeps.',
  steps,
};

// The addition must be ABSENT on the baseline, and must fail for the right reason. Checked, not assumed.
const { playCheck } = await import('./playCheck.js');
const ws2 = mkdtempSync(join(tmpdir(), 'emitcheck-'));
let base;
try {
  writeFileSync(join(ws2, 'index.html'), html, 'utf8');
  base = await playCheck(ws2, spec);
} finally { if (existsSync(ws2)) { try { rmSync(ws2, { recursive: true, force: true }); } catch { /* best effort */ } } }
const passing = [...(base.passing || [])].sort((a, b) => a - b);
const failing = [...(base.failing || [])].sort((a, b) => a - b);

const EXISTING_STEPS = [1, 2, 3, 7];
const ADDITION_STEPS = [4, 5];
const okExisting = EXISTING_STEPS.every((n) => passing.includes(n));
const okAbsent = ADDITION_STEPS.every((n) => failing.includes(n));

console.log(`page            ${file}`);
console.log(`sha256          ${sha(html).slice(0, 16)}`);
console.log(`load state      ${JSON.stringify(loadState)}`);
console.log(`existing keys   ${existing.join(', ')}   using '${K}'`);
console.log(`trigger         '${TRIGGER}'`);
console.log(`baseline run    passing [${passing.join(',')}]  failing [${failing.join(',')}]`);
console.log(`  existing behaviour passes on the baseline : ${okExisting}`);
console.log(`  the addition is ABSENT on the baseline    : ${okAbsent}`);
for (const c of (base.cases || [])) if (c.kind !== 'PASS') console.log(`    FAIL ${c.n}: ${String(c.text).slice(0, 150)}`);

if (!okExisting || !okAbsent) {
  console.error(`\nNOT EMITTED: a task is only valid when the page's own behaviour passes AND the addition fails`);
  process.exit(6);
}

const sub = (ns) => ({ ...spec, name: `steps-${ns.join('')}`, steps: spec.steps.filter((x) => ns.includes(x.n)) });
const task = {
  id: `set3-${DIR.split(/[\\/]/).filter(Boolean).pop()}`, group: 'SET3', source: 'internal', language: 'javascript', kind: 'build',
  dependsOn: null,
  goal: `Continue the page already in index.html. Pressing ${TRIGGER} returns every piece of state to what it was when the page loaded. Everything that already works must keep working. The page is a single self-contained web page, index.html: plain HTML5 canvas and JavaScript, no frameworks, no external files or CDNs. ${spec.contract}`,
  requirement: {
    trigger: { kind: 'key', key: TRIGGER },
    effects: ['every piece of state is back to its starting value'],
    invariants: [`the ${K} key keeps working`, 'everything that already works keeps working'],
  },
  seed: {},
  requested: { play: { spec: sub([1, 2, 3, 4, 5, 6, 7]), steps: [1, 2, 3, 4, 5, 6, 7] } },
  accumulates: ['the page as delivered'],
  supersedes: [],
  protected: { plays: [{ from: 'the page as delivered', spec: sub(EXISTING_STEPS), steps: EXISTING_STEPS }] },
  diagnostic: { kind: 'play', spec: sub([1, 2, 3, 4, 5, 6, 7]), timeoutSec: 90 },
  upstreamCases: 7, protectedCases: EXISTING_STEPS.length,
  provenance: {
    baselineSha: sha(html), triggerKey: TRIGGER, existingKeys: existing, keyUsed: K,
    loadState, after1, after2,
    emittedAt: new Date().toISOString(),
    note: 'existing-behaviour expectations come from OBSERVATION; addition expectations come from the frozen rule',
  },
};
writeFileSync(join(DIR, 'play.json'), JSON.stringify(spec, null, 2) + NL, 'utf8');
writeFileSync(join(DIR, 'task.json'), JSON.stringify(task, null, 2) + NL, 'utf8');
console.log(`\nEMITTED ${join(DIR, 'task.json')} and play.json   task id ${task.id}`);
