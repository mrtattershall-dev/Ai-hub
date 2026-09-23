/**
 * benchSeeds.test.mjs - VALIDATE EVERY BENCHMARK SEED, before any generation.
 *
 *   node server/benchSeeds.test.mjs
 *
 * For all 20 tasks:
 *   the seed FAILS its requested check      there is real work to do
 *   the seed PASSES its protected check     nothing is inherited broken
 *   a KNOWN-GOOD implementation PASSES both the positive control
 *
 * The positive control is not optional. Both Python checks in the pilot could NEVER pass -
 * JSON.stringify turned newlines into backslash-n and Python died on line 1 - and every seed
 * "failed" its requested check, which looks exactly like a correct seed. Only a known-good
 * reference distinguishes a check that fails from a check that cannot run.
 *
 * Reference solutions live OUTSIDE the model's reach: they are used here and never placed in a
 * task workspace.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = join(HERE, '..', 'legasus', 'bench', 'quixbugs');
const { benchQueue, externalTasks, SEQUENTIAL_TASKS } = await import('./benchTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

/** Known-good implementations, kept outside every task workspace. */
const REFERENCE = {
  'seq-1-count': 'function addEntry(entries, item) { return [...entries, item]; }\nfunction total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }\nfunction count(entries) { return entries.length; }\nmodule.exports = { addEntry, total, count };\n',
  'seq-2-largest': 'function addEntry(entries, item) { return [...entries, item]; }\nfunction total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }\nfunction count(entries) { return entries.length; }\nfunction largest(entries) { return entries.length ? entries.reduce((a, b) => (b.amount > a.amount ? b : a)) : null; }\nmodule.exports = { addEntry, total, count, largest };\n',
  'seq-3-byitem': 'function addEntry(entries, item) { return [...entries, item]; }\nfunction total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }\nfunction count(entries) { return entries.length; }\nfunction largest(entries) { return entries.length ? entries.reduce((a, b) => (b.amount > a.amount ? b : a)) : null; }\nfunction byItem(entries) { const m = {}; for (const e of entries) m[e.item] = (m[e.item] || 0) + e.amount; return m; }\nmodule.exports = { addEntry, total, count, largest, byItem };\n',
  'seq-4-remove': 'function addEntry(entries, item) { return [...entries, item]; }\nfunction total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }\nfunction count(entries) { return entries.length; }\nfunction largest(entries) { return entries.length ? entries.reduce((a, b) => (b.amount > a.amount ? b : a)) : null; }\nfunction byItem(entries) { const m = {}; for (const e of entries) m[e.item] = (m[e.item] || 0) + e.amount; return m; }\nfunction removeItem(entries, name) { return entries.filter((e) => e.item !== name); }\nmodule.exports = { addEntry, total, count, largest, byItem, removeItem };\n',
  'seq-5-summary': 'function addEntry(entries, item) { return [...entries, item]; }\nfunction total(entries) { return entries.reduce((a, e) => a + e.amount, 0); }\nfunction count(entries) { return entries.length; }\nfunction largest(entries) { return entries.length ? entries.reduce((a, b) => (b.amount > a.amount ? b : a)) : null; }\nfunction byItem(entries) { const m = {}; for (const e of entries) m[e.item] = (m[e.item] || 0) + e.amount; return m; }\nfunction removeItem(entries, name) { return entries.filter((e) => e.item !== name); }\nfunction summary(entries) { return { count: count(entries), total: total(entries), largest: largest(entries) }; }\nmodule.exports = { addEntry, total, count, largest, byItem, removeItem, summary };\n',
};

const dirs = [];
function materialise(task, overlay) {
  const ws = mkdtempSync(join(tmpdir(), 'bseed-')); dirs.push(ws);
  for (const [f, body] of Object.entries({ ...task.seed, ...(overlay || {}) })) {
    mkdirSync(join(ws, f, '..'), { recursive: true });
    writeFileSync(join(ws, f), body, 'utf8');
  }
  const g = (...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=s@s', '-c', 'user.name=s', 'commit', '-q', '-m', 'seed');
  return ws;
}

try {
  const queue = benchQueue();
  console.log(`=== ${queue.length} tasks: ${externalTasks().length} external + ${SEQUENTIAL_TASKS.length} sequential ===`);
  say(externalTasks().length === 15, `15 external tasks (${externalTasks().length})`);
  say(SEQUENTIAL_TASKS.length === 5, `5 sequential tasks (${SEQUENTIAL_TASKS.length})`);
  say(existsSync(join(BENCH, 'LICENSE')), 'the upstream LICENSE is vendored alongside the tasks');
  say(existsSync(join(BENCH, 'SELECTION.json')), 'and the frozen selection record');

  // ── EXTERNAL ──
  console.log('\n=== external seeds (upstream data, replaced runner) ===');
  let extOk = 0;
  for (const t of externalTasks()) {
    const ws = materialise(t);
    const r = await evaluate(ws, t);
    const good = r.requested?.verdict === VERDICT.FAIL && r.protected?.verdict === VERDICT.PASS;
    if (good) extOk++;
    else say(false, `${t.id}: requested=${r.requested?.verdict} protected=${r.protected?.verdict} (want FAIL/PASS) ${String(r.requested?.out || '').slice(0, 60)}`);

    // POSITIVE CONTROL: the upstream reference, kept outside the workspace
    const refSrc = readFileSync(join(BENCH, t.id.replace('ext-', ''), 'reference.py'), 'utf8');
    const refWs = materialise(t, { [`${t.id.replace('ext-', '')}.py`]: refSrc });
    const rr = await evaluate(refWs, t);
    if (rr.verdict !== VERDICT.PASS) {
      say(false, `${t.id}: POSITIVE CONTROL failed - the upstream reference does not pass (${rr.verdict}) ${String(rr.requested?.out || '').slice(0, 60)}`);
    }
  }
  say(extOk === 15, `all 15 external seeds fail requested and pass protected (${extOk}/15)`);
  note('The protected set is DISCOVERED: it is the subset already passing on the upstream seed.');

  // ── SEQUENTIAL ──
  console.log('\n=== sequential seeds (internally authored) ===');
  let seqOk = 0;
  // A CHAIN STEP IS NOT SEEDED FROM THE BASE PROJECT.
  //
  // Step N starts from step N-1's ACCEPTED STATE. Validating step 2 against the base seed
  // reported protected=FAIL - correctly, because step 2's protected check requires step 1's
  // work, which the base seed does not have. The tasks were right; the validation was wrong.
  // Each step is therefore checked against the state it will ACTUALLY start from.
  for (let i = 0; i < SEQUENTIAL_TASKS.length; i++) {
    const t = SEQUENTIAL_TASKS[i];
    const startFrom = i === 0 ? null : { 'ledger.js': REFERENCE[SEQUENTIAL_TASKS[i - 1].id] };
    const ws = materialise(t, startFrom);
    const r = await evaluate(ws, t);
    const good = r.requested?.verdict === VERDICT.FAIL && r.protected?.verdict === VERDICT.PASS;
    if (good) seqOk++;
    else say(false, `${t.id}: requested=${r.requested?.verdict} protected=${r.protected?.verdict} (want FAIL/PASS)`);

    const refWs = materialise(t, { 'ledger.js': REFERENCE[t.id] });
    const rr = await evaluate(refWs, t);
    if (rr.verdict !== VERDICT.PASS) {
      say(false, `${t.id}: POSITIVE CONTROL failed - the known-good implementation does not pass (${rr.verdict}) ${String(rr.requested?.out || rr.protected?.out || '').slice(0, 70)}`);
    }
  }
  say(seqOk === 5, `all 5 sequential seeds fail requested and pass protected (${seqOk}/5)`);
  say(SEQUENTIAL_TASKS.every((t, i) => (i === 0 ? t.dependsOn === null : t.dependsOn === SEQUENTIAL_TASKS[i - 1].id)),
    'the chain is linear: each step depends on the one before it');
  note('Step N\'s protected check is every earlier step\'s requested check, so accumulation');
  note('is measured by whether earlier work KEEPS passing.');

  // ── reference solutions must never reach a workspace ──
  console.log('\n=== reference solutions are outside model access ===');
  const anySeedHasRef = benchQueue().some((t) => Object.keys(t.seed).some((f) => /reference/i.test(f)));
  say(!anySeedHasRef, 'no task seed contains a reference solution');
  const anyCheckLeaksRef = benchQueue().some((t) => JSON.stringify(t.requested).includes('reference.py') || JSON.stringify(t.protected || {}).includes('reference.py'));
  say(!anyCheckLeaksRef, 'and no check materialises one into the container');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  benchmark seeds: ${passed} passed, ${failed} failed -> ${failed ? 'THE QUEUE IS NOT FIT TO RUN' : 'every seed has real work and a sound starting point'}`);
process.exit(failed ? 1 : 0);
