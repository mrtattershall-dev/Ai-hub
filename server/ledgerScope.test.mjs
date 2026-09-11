/**
 * ledgerScope.test.mjs - tasks left over from earlier goals show only where they can matter.
 *
 *   node server/ledgerScope.test.mjs
 *
 * Set E (2026-09-11), 100 interleaved goals in one workspace: goal 1's plan tasks ("Create q1_stock.js ...") rode on the
 * ledger of every later goal, "0/9 done", in every model call - and the 14B acted on them (goal 8, about q8_units.py,
 * closed "Create q1_stock.js"). The rule now:
 *   - a leftover that names a file shows when the goal names that file, however many goals later
 *     (so the rollback's "Re-add X to f" reaches the next goal on f);
 *   - a leftover naming no file shows for the one goal right after its own, then drops out;
 *   - hidden leftovers are counted in the block, and TASKS.md keeps them all;
 *   - a run's own tasks always show; a caller with no goal sees everything, as before.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ledger from './taskLedger.js';

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nleftover tasks are scoped to the goal\n');

// Goal 1 (q1) seeds its plan and finishes nothing.
const ws = mkdtempSync(join(tmpdir(), 'ledger-'));
ledger.seed(ws, ['Create `q1_stock.js` with the Warehouse class skeleton', 'Implement the addItem method with validation']);
ledger.adopt(ws, 'r2');                                   // goal 2 starts
const b2 = ledger.contextBlock(ws, 'Create q2_table.py with parse_csv(text) returning a list of dicts.');
test('the goal right after: a leftover naming ANOTHER file is hidden', () => assert.doesNotMatch(b2, /q1_stock\.js/, b2));
test('the goal right after: a leftover naming no file still shows (it may be a continuation)', () => assert.match(b2, /addItem/, b2));
test('hidden leftovers are counted, not silently dropped', () => assert.match(b2, /1 task\(s\) left over from earlier goals/, b2));

ledger.adopt(ws, 'r3');                                   // goal 3 starts
const b3 = ledger.contextBlock(ws, 'Create q3_calendar.js exporting a Calendar class.');
test('two goals later the no-file leftover drops out too', () => {
  assert.doesNotMatch(b3, /addItem/, b3);
  assert.match(b3, /2 task\(s\) left over/, b3);
  assert.match(b3, /nothing open for this goal/, b3);
});
test('a later goal on the SAME file sees the leftover that names it', () => {
  assert.match(ledger.contextBlock(ws, 'Add remove(sku, qty) to the EXISTING q1_stock.js.'), /Create `q1_stock\.js`/);
});
test('a caller with no goal sees everything, as before', () => {
  const b = ledger.contextBlock(ws);
  assert.match(b, /q1_stock\.js/); assert.match(b, /addItem/); assert.doesNotMatch(b, /not shown/);
});
test('the markers round-trip and the task text stays clean', () => {
  const f = readFileSync(join(ws, 'TASKS.md'), 'utf8');
  assert.match(f, /<!--aged-->/);
  const t = ledger.read(ws).find((x) => /addItem/.test(x.title));
  assert.equal(t.aged, true); assert.equal(t.carried, true);
  assert.doesNotMatch(t.title, /<!--/);
});

// The rollback's carry-over task: added at the end of a q7 goal, then unrelated goals, then q7 again.
const ws2 = mkdtempSync(join(tmpdir(), 'ledger-'));
ledger.add(ws2, ['Re-add getText, redo to q7_buffer.js - lost when q7_buffer.js was rolled back at the end of a run because it did not parse']);
ledger.adopt(ws2, 'r18'); ledger.adopt(ws2, 'r19'); ledger.adopt(ws2, 'r20');
test('a Re-add task stays out of unrelated goals', () => {
  assert.doesNotMatch(ledger.contextBlock(ws2, 'Create q8_units.py with convert(value, from_unit, to_unit).'), /Re-add/);
});
test('...and reaches the next goal on its file, three goals later', () => {
  assert.match(ledger.contextBlock(ws2, 'Add edit groups to the EXISTING q7_buffer.js.'), /Re-add getText, redo to q7_buffer\.js/);
});
test("a run's OWN tasks always show, whatever the goal", () => {
  ledger.add(ws2, ['Write the parser']);
  assert.match(ledger.contextBlock(ws2, 'Create q9_shop.html with a cart.'), /Write the parser/);
});
test('the finish gate still counts only own tasks', () => {
  const p = ledger.progress(ws2);
  assert.equal(p.remainingOwn, 1); assert.equal(p.carried, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
