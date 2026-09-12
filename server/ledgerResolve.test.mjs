/**
 * ledgerResolve.test.mjs - which task task_done actually closes.
 *
 *   node server/ledgerResolve.test.mjs
 *
 * Set G (2026-09-11), measured in the kept run records, not inferred. 44 real task_done calls across the two
 * batteries (40 in coder30b-setg, 4 in coder14b-setg). ZERO returned "no task matches". 43 of the 44 closed a task
 * left over from GOAL 1 while the model was working on a completely different goal:
 *
 *   30B, 39 of 40 calls -> OK: "HOW TO VERIFY: Run `node s1_library.js` and check that all asserts pass" done
 *   14B,  4 of  4 calls -> OK: "Create `s1_library.js` with the `Library` class." done
 *
 * Three independent defects made that possible, and each gets its own cases below.
 *
 * 1. parseInt IS PREFIX-GREEDY. `parseInt("1. Computes + - * / operations...", 10)` is 1, so a TITLE that begins with
 *    a digit resolved as a POSITION. Live: run 256f1ad4 sent exactly that string and closed global task 1.
 *
 * 2. A BARE NUMBER MEANS "MY FIRST TASK" TO THE MODEL, and global position 1 to the ledger. adopt() marks goal 1's
 *    tasks carried but never removes them, so position 1 stayed goal 1's work for the whole battery. 39 of the 40 30B
 *    calls sent "1". Worse, contextBlock() hides aged carried tasks from the rendered list while read() still numbers
 *    globally - so the model was closing a task it could not even see.
 *
 * 3. mark() NEVER CHECKED WHETHER THE TASK WAS ALREADY DONE. Run 7afb8151 (the earliest task_done in the 30B battery)
 *    closed that task legitimately as its own. Every one of the 39 later calls re-closed an ALREADY-DONE task and was
 *    told "OK". A no-op reported as success is the exact silent-failure shape this repo keeps paying for.
 *
 * HOW THESE CASES ARE WRITTEN - two masking traps, both real:
 *   - Assert on WHICH TASK'S STATE CHANGED in TASKS.md, never on the returned message. agent.js's carried branch
 *     rewrites the wording and makes a wrong close read plausibly.
 *   - Never assert through contextBlock(): its goal-scoping hides aged carried tasks, so a bug is invisible there.
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
  catch (e) {
    if (n.startsWith('(known)')) { known++; openCases.push(n); console.log(`  known ${n}\n        ${e.message}`); }
    else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
  }
};
const fresh = () => mkdtempSync(join(tmpdir(), 'ledger-resolve-'));
// State read back off DISK, which is the only thing that matters: [state, ...] in file order.
const states = (ws) => ledger.read(ws).map((t) => t.state);
const titles = (ws) => ledger.read(ws).map((t) => t.title);

console.log('\nwhich task does task_done actually close\n');

// ---------------------------------------------------------------- 1. the prefix-greedy parseInt (run 256f1ad4)

test('a TITLE that begins with a digit does not resolve as a POSITION (run 256f1ad4)', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js', 'Add addBook']);
  ledger.adopt(ws, 'run2');
  const before = states(ws);
  const r = ledger.mark(ws, '1. Computes + - * / operations on numbers (integers and dec', 'done');
  assert.deepEqual(states(ws), before,
    `a title beginning with "1." closed task ${r.n} ("${r.task?.title}") - parseInt is prefix-greedy`);
  assert.equal(r.ok, false, 'it reported success for a task it did not close');
});

test('...and that holds where NO other guard could save it (isolates the numeric parse)', () => {
  // The case above ALSO trips the carried-task guard, so it stays green even with parseInt prefix-greed restored -
  // the mutant escaped on exactly that overlap. Here nothing is carried and nothing is done, so the only rule that
  // can refuse this is "a number has to be the WHOLE string".
  const ws = fresh();
  ledger.add(ws, ['write the parser', 'verify it runs']);
  const before = states(ws);
  const r = ledger.mark(ws, '1. Computes + - * / operations on numbers', 'done');
  assert.equal(r.ok, false, `a title beginning with "1." closed task ${r.n} ("${r.task?.title}")`);
  assert.deepEqual(states(ws), before, 'a title beginning with a digit was resolved as a position');
});

test('a numeric-looking string that is really a TITLE closes that title when it exists', () => {
  const ws = fresh();
  ledger.add(ws, ['1. Computes + - * / operations', 'write the parser']);
  const r = ledger.mark(ws, '1. Computes + - * / operations', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['done', 'todo'], 'it resolved the title as a position');
});

// ---------------------------------------------------------------- 2. a bare number landing on another goal's work

test('a bare number is refused when it lands on a task LEFT OVER from an earlier goal', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js with the Library class', 'Add addBook']);
  ledger.adopt(ws, 'run2');                      // a later goal starts; both tasks are now carried
  const before = states(ws);
  const r = ledger.mark(ws, '1', 'done');
  assert.equal(r.ok, false, `"1" closed "${r.task?.title}", which belongs to an earlier goal`);
  assert.deepEqual(states(ws), before, 'an earlier goal\'s task changed state');
});

test('the refusal names the leftover, so the model can act on the answer', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js with the Library class']);
  ledger.adopt(ws, 'run2');
  const r = ledger.mark(ws, '1', 'done');
  assert.equal(r.ok, false);
  assert.match(r.error, /left over|earlier/i, `unhelpful error: ${r.error}`);
  assert.match(r.error, /Create s1_library\.js/, `the error does not say WHICH task: ${r.error}`);
});

test("a bare number still closes THIS run's own task", () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser', 'verify it runs']);
  const r = ledger.mark(ws, '2', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['todo', 'done']);
});

test('a leftover can still be closed DELIBERATELY, by naming it', () => {
  const ws = fresh();
  ledger.seed(ws, ['Re-add getText to q7_buffer.js', 'Add addBook']);
  ledger.adopt(ws, 'run2');
  const r = ledger.mark(ws, 'Re-add getText to q7_buffer.js', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['done', 'todo']);
});

// ---------------------------------------------------------------- 3. re-closing an already-done task

test('an already-done task cannot be closed again (39 of the 40 30B calls)', () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser', 'verify it runs']);
  ledger.mark(ws, '1', 'done');
  const r = ledger.mark(ws, '1', 'done');
  assert.equal(r.ok, false, 'a no-op was reported as success - the ledger\'s whole job is to be trusted');
  assert.match(r.error, /already done/i, `the error does not say why: ${r.error}`);
});

test('re-closing does not disturb any other task', () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser', 'verify it runs']);
  ledger.mark(ws, '1', 'done');
  const before = states(ws);
  ledger.mark(ws, '1', 'done');
  assert.deepEqual(states(ws), before);
});

test('reopening a done task and closing it again is still allowed', () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser']);
  ledger.mark(ws, '1', 'done');
  ledger.mark(ws, '1', 'todo');
  const r = ledger.mark(ws, '1', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['done']);
});

// ---------------------------------------------------------------- 4. unanchored / ambiguous title matching

test('an ambiguous title is REFUSED, not resolved to the first match', () => {
  const ws = fresh();
  ledger.add(ws, ['Add addBook to the Library', 'Add addBookCopy to the Library']);
  const before = states(ws);
  // A prefix of BOTH, and an exact title of neither. Guessing the first is how a substring closes the wrong task.
  const r = ledger.mark(ws, 'Add addBook', 'done');
  assert.equal(r.ok, false, `it guessed "${r.task?.title}" out of two candidates`);
  assert.deepEqual(states(ws), before);
  assert.match(r.error, /Add addBookCopy to the Library/, `the error does not list the candidates: ${r.error}`);
});

test('an EXACT title wins even when it is also a prefix of another task', () => {
  const ws = fresh();
  ledger.add(ws, ['Add addBook', 'Add addBookCopy']);
  // Exactness is the strongest signal the model can give: it named task 1 in full, so it is not ambiguous.
  const r = ledger.mark(ws, 'Add addBook', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['done', 'todo']);
});

test('a mid-word substring does not match (it closed the wrong task before)', () => {
  const ws = fresh();
  ledger.add(ws, ['Create s1_library.js with the Library class', 'write the parser']);
  const before = states(ws);
  const r = ledger.mark(ws, 'ibrary.js with', 'done');
  assert.equal(r.ok, false, `a mid-word fragment closed "${r.task?.title}"`);
  assert.deepEqual(states(ws), before);
});

test('a whole-word fragment still works (the fakemodel and agent_audit contract)', () => {
  const ws = fresh();
  ledger.add(ws, ['build the thing', 'test the thing', 'polish the thing']);
  const r = ledger.mark(ws, 'polish', 'done');
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(states(ws), ['todo', 'todo', 'done']);
});

test('a title that matches nothing is still refused', () => {
  const ws = fresh();
  ledger.add(ws, ['build the thing']);
  const r = ledger.mark(ws, 'nonexistent', 'done');
  assert.equal(r.ok, false);
  assert.deepEqual(states(ws), ['todo']);
});

// ---------------------------------------------------------------- 5. the invariants that must hold whatever happens

test('a refused call NEVER changes the file at all', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js', 'Add addBook']);
  ledger.adopt(ws, 'run2');
  const raw = readFileSync(join(ws, 'TASKS.md'), 'utf8');
  for (const w of ['1', '2', '1. Computes + - * /', 'nonexistent', '99', '']) ledger.mark(ws, w, 'done');
  assert.equal(readFileSync(join(ws, 'TASKS.md'), 'utf8'), raw, 'a refused call rewrote the ledger');
});

test('a successful call reports the task it actually changed', () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser', 'verify it runs']);
  const r = ledger.mark(ws, '2', 'done');
  assert.equal(r.ok, true, r.error);
  assert.equal(r.n, 2);
  assert.equal(r.task.title, 'verify it runs');
  assert.equal(ledger.read(ws)[r.n - 1].state, 'done', 'r.n points at a different task than the one that changed');
});

test('out-of-range and empty input are refused, not coerced', () => {
  const ws = fresh();
  ledger.add(ws, ['write the parser']);
  for (const w of ['0', '99', '', '   ', null, undefined]) {
    const before = states(ws);
    const r = ledger.mark(ws, w, 'done');
    assert.equal(r.ok, false, `mark(${JSON.stringify(w)}) was accepted`);
    assert.deepEqual(states(ws), before);
  }
});

test('marking in progress goes through the same resolution', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js', 'Add addBook']);
  ledger.adopt(ws, 'run2');
  const before = states(ws);
  const r = ledger.mark(ws, '1', 'doing');
  assert.equal(r.ok, false, 'a leftover was marked in progress by position');
  assert.deepEqual(states(ws), before);
});

test('the ledger still round-trips: nothing is lost by a refusal', () => {
  const ws = fresh();
  ledger.seed(ws, ['Create s1_library.js', 'Add addBook', 'write the parser']);
  ledger.adopt(ws, 'run2');
  ledger.mark(ws, '1', 'done');
  assert.deepEqual(titles(ws), ['Create s1_library.js', 'Add addBook', 'write the parser']);
  assert.ok(ledger.read(ws).every((t) => t.carried), 'the carried markers were lost');
});

const KNOWN_EXPECTED = 0;   // bugs known open today; see the header for what and why
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
// The one line the suite runner greps, so a green file can never hide an open bug in the summary.
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
// A count that DROPS means a case labelled "(known)" now passes - the label is a lie. A count that RISES means a new
// failure hid behind the label. Both fail the file.
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
