/**
 * exportNamesShapes.test.mjs - pin every CommonJS export shape exportNames() must see.
 *
 *   node server/exportNamesShapes.test.mjs
 *
 * WHY, measured 2026-09-13. exportNames() is shared: agent.js uses it on the write path via
 * lostExports() to warn "this write REMOVED what the file exported". Probed across real shapes, it
 * returns NOTHING for two that are perfectly ordinary and NAMED:
 *     module.exports = function add(a, b) { ... }
 *     module.exports = class Library {}
 * Consequences on both routes, not one:
 *   - a rewrite TO that shape reads as "export lost: add"  -> a FALSE warning about correct code
 *   - a rewrite FROM it reads as no loss at all            -> a real loss goes unreported
 * That is the too-narrow direction which already manufactured a false 0/5 tonight, and
 * verifyExportsGoal.test.mjs separately pins that this shape IS a valid export.
 *
 * RED-FIRST: the two cases marked THE GAP fail before the fix. The anonymous and arrow cases must stay
 * EMPTY forever - there is no name to report, and inventing one would be a checker making things up.
 */
import assert from 'node:assert/strict';
import { exportNames, lostExports } from './defNames.js';

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 3).join('\n        ')); } };
const names = (src) => [...(exportNames(src, 'x.js') || [])].sort();

console.log('\nexportNames must see every NAMED export shape, and invent none\n');

test('already works: module.exports = { add }',       () => assert.deepEqual(names('module.exports = { add };'), ['add']));
test('already works: module.exports = add',           () => assert.deepEqual(names('module.exports = add;'), ['add']));
test('already works: exports.add = add',              () => assert.deepEqual(names('exports.add = add;'), ['add']));
test('already works: ESM export function add',        () => assert.deepEqual(names('export function add(a, b) { return a + b; }'), ['add']));

test('THE GAP: module.exports = function add(...)', () => {
  assert.deepEqual(names('module.exports = function add(a, b) { return a + b; };'), ['add']);
});
test('THE GAP: module.exports = class Library {}', () => {
  assert.deepEqual(names('module.exports = class Library { addBook() {} };'), ['Library']);
});

test('MUST STAY EMPTY: anonymous function has no name to report', () => {
  assert.deepEqual(names('module.exports = function (a, b) { return a + b; };'), []);
});
test('MUST STAY EMPTY: arrow has no name to report', () => {
  assert.deepEqual(names('module.exports = (a, b) => a + b;'), []);
});

test('THE SIBLING ROUTE: rewriting TO the named-function shape is NOT an export loss', () => {
  const before = 'function add(a,b){return a+b}\nmodule.exports = { add };\n';
  const after = 'module.exports = function add(a, b) { return a + b; };\n';
  assert.deepEqual(lostExports(before, after, 'x.js'), [],
    'lostExports falsely reports a loss, so the hub warns about correct code');
});
test('THE SIBLING ROUTE: a genuine loss from that shape is still reported', () => {
  const before = 'module.exports = function add(a, b) { return a + b; };\n';
  const after = 'function add(a, b) { return a + b; }\n';
  assert.deepEqual(lostExports(before, after, 'x.js'), ['add']);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
