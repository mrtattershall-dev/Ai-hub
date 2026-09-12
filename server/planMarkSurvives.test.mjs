/**
 * planMarkSurvives.test.mjs - ticking a task off must not turn the finish gate from advisory into binding.
 *
 *   node server/planMarkSurvives.test.mjs
 *
 * `<!-- seeded-from-plan -->` in TASKS.md IS the storage for isPlanSeeded(): write() emits it only when its third
 * argument is true, and isPlanSeeded() reads it back off disk. Four call sites, and they do not agree:
 *
 *   adopt()  taskLedger.js:157  write(ws, tasks, isPlanSeeded(ws))   preserves - correct
 *   seed()   taskLedger.js:168  write(ws, tasks, true)               sets it - correct
 *   add()    taskLedger.js:226  write(ws, tasks, false)              clears it - CORRECT AND DELIBERATE: once the
 *                                                                    agent adds its own tasks the ledger is no longer
 *                                                                    plan-derived, and add()'s own `pristinePlan`
 *                                                                    check at :196 depends on that
 *   mark()   taskLedger.js:325  write(ws, tasks)                     clears it - THE BUG. The third argument defaults
 *                                                                    to false, so the FIRST successful tick of any
 *                                                                    task erases the marker.
 *
 * Why that matters, from the branch it controls (agent.js:3170-3183):
 *     const advisory = ledger.isPlanSeeded(WORKSPACE);
 *     if (advisory && p.remaining > 0)  -> push a NOTE: "they were proposals, not commitments"
 *     if (!advisory && p.total && p.remainingOwn > 0) -> blocked(...) and `continue turn` - the run CANNOT finish
 * The comment above that line records why the advisory branch exists: a free model was handed 15 plan tasks and spent
 * 10 steps closing them, and three scripted tests ended 'stopped' instead of 'done' because the agent had finished its
 * actual work and was blocked on entries it never chose - one of which stopped the supervisor firing at all. So this
 * defect silently reinstates the exact failure that branch was written to prevent, and it does so the moment the agent
 * makes progress. Set G's shape reaches it: ZERO task_add calls across 136 runs (so add() never cleared the marker)
 * and 44 task_done calls (so mark() did).
 *
 * Nothing asserted any of this before - zero hits for isPlanSeeded or seeded-from-plan across every *.test.mjs. It
 * survived because it was never measured, not because it was considered and accepted.
 *
 * FIXED 2026-09-12: mark() now calls write(workspace, tasks, isPlanSeeded(workspace)), mirroring adopt(). Two
 * mutants confirm both halves are pinned - reverting mark() to the defaulting call puts the marker and gate cases
 * back to red, and forcing `true` in add() reds the guard that keeps task_add superseding the plan.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ledger from './taskLedger.js';

let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = (n, f) => {
  try { f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe plan marker survives progress, and only task_add supersedes it\n');

const fresh = () => mkdtempSync(join(tmpdir(), 'planmark-'));
const body = (ws) => readFileSync(join(ws, 'TASKS.md'), 'utf8');

// ── the premise: seed() sets the marker, and the gate would treat open tasks as advisory ──
const a = fresh();
ledger.seed(a, ['Create s1_library.js with the Library class', 'Add addBook(title)']);
test('the premise: a plan-seeded ledger is marked', () => {
  assert.equal(ledger.isPlanSeeded(a), true, 'seed() did not mark it:\n' + body(a));
});
test('the premise: it has open tasks the gate would otherwise hold the run to', () => {
  const p = ledger.progress(a);
  assert.ok(p.total > 0 && p.remainingOwn > 0, 'nothing open, so the gate branch is not reachable: ' + JSON.stringify(p));
});

// ── the bug: one successful mark erases it ──
test('ticking a task off does NOT erase the plan marker', () => {
  const r = ledger.mark(a, 'Add addBook(title)', 'done');
  assert.equal(r.ok, true, 'the fixture could not close the task: ' + JSON.stringify(r));
  assert.equal(ledger.isPlanSeeded(a), true,
    'the first successful mark erased <!-- seeded-from-plan -->, so the finish gate flips from advisory to BINDING:\n'
    + body(a));
});
test('and the run is still in the advisory branch, not the blocking one', () => {
  const p = ledger.progress(a);
  const advisory = ledger.isPlanSeeded(a);
  assert.ok(!(!advisory && p.total && p.remainingOwn > 0),
    `agent.js:3178 would now block this run: advisory=${advisory} total=${p.total} remainingOwn=${p.remainingOwn}`);
});

// ── the other half of the contract: add() must STILL clear it. Over-fixing breaks pristinePlan at :196. ──
const b = fresh();
ledger.seed(b, ['Create s2_logs.py', 'Add parse(line)']);
ledger.add(b, ['my own task the agent chose']);
test('task_add still supersedes the plan marker (this must NOT be "fixed")', () => {
  assert.equal(ledger.isPlanSeeded(b), false,
    'add() no longer clears the marker; pristinePlan at taskLedger.js:196 depends on it to replace a pristine plan:\n'
    + body(b));
});
test('and a pristine plan was replaced by the agent\'s own list, not appended to', () => {
  const titles = ledger.read(b).map((t) => t.title);
  assert.deepEqual(titles, ['my own task the agent chose'],
    'the plan should have been replaced wholesale by the agent\'s own list: ' + JSON.stringify(titles));
});

// ── adopt() already preserves it; pinned so a future edit cannot quietly regress the one call site that is right ──
const c = fresh();
ledger.seed(c, ['Create s3_matrix.js']);
ledger.adopt(c, 'run-2');
test('adopt() preserves the marker across a run boundary', () => {
  assert.equal(ledger.isPlanSeeded(c), true, 'adopt() dropped it:\n' + body(c));
});

const KNOWN_EXPECTED = 0;   // both landed 2026-09-12: mark() now preserves the marker, so the gate stays advisory
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
