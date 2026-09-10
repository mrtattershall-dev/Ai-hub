/**
 * ledgerAtomic.test.mjs - TASKS.md must never be observed half-written.
 *
 *   node server/ledgerAtomic.test.mjs
 *
 * The ledger is rewritten in full on every mark/add - dozens of times in a long run, from
 * the run loop, from sub-tasks and from the supervisor. It used to be a plain
 * writeFileSync, which truncates the file and then fills it, so a crash or a Stop in the
 * middle left a partial ledger. This file has been corrupted that way before (six
 * concurrent runs, 2026-09). It is now written to a sibling temp file and renamed.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ledger = await import('./taskLedger.js');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const ws = mkdtempSync(join(tmpdir(), 'ledger-'));
const noTemps = () => assert.deepEqual(readdirSync(ws).filter((f) => f.endsWith('.tmp')), [], 'a temp file was left behind');

console.log('\nledger atomicity\n');

test('seed then read round-trips', () => {
  ledger.seed(ws, ['first task', 'second task', 'third task']);
  const tasks = ledger.read(ws);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].title, 'first task');
});

test('no .tmp file is left behind', noTemps);

test('marking a task rewrites the whole ledger intact', () => {
  ledger.mark(ws, 1, 'done');
  const tasks = ledger.read(ws);
  assert.equal(tasks.length, 3, 'a rewrite lost tasks');
  assert.equal(tasks[0].state, 'done');
  assert.equal(tasks[2].title, 'third task', 'the tail of the file was truncated');
});

test('seed caps a runaway plan at 40 (documented behaviour, not truncation)', () => {
  // seed() deliberately slices to 40: a plan that produced hundreds of "tasks" is a
  // runaway planner, not a work list. Pinned so the cap stays a decision, not a surprise.
  ledger.seed(ws, Array.from({ length: 300 }, (_, i) => 'task number ' + i));
  assert.equal(ledger.read(ws).length, 40);
});

test('a full-size ledger survives a rewrite intact', () => {
  const many = Array.from({ length: 40 }, (_, i) => 'task number ' + i + ' with a reasonably long title');
  ledger.seed(ws, many);
  ledger.mark(ws, 20, 'done');
  const tasks = ledger.read(ws);
  assert.equal(tasks.length, 40, 'expected 40 tasks, got ' + tasks.length);
  assert.equal(tasks[39].title, many[39], 'the end of the ledger was lost in the rewrite');
  noTemps();
});

test('the file on disk is always complete markdown', () => {
  const name = readdirSync(ws).find((f) => /TASKS/i.test(f));
  const body = readFileSync(join(ws, name), 'utf8');
  assert.ok(body.endsWith('\n'), 'file does not end cleanly - a truncated write would not');
  assert.ok(body.includes('task number 39'), 'last entry missing');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
