/**
 * exportShadowing.test.mjs - exportNames() must agree with the Node RUNTIME, not with a union
 * of every export-looking line.
 *
 *   node server/exportShadowing.test.mjs
 *
 * THE DEFECT, measured 2026-09-13. exportNames() collected names from every
 * `module.exports = {...}` match and unioned them. JavaScript is last-assignment-wins, so a file
 * holding
 *
 *     module.exports = { tokenize, toRPN, compile };
 *     module.exports = { tokenize };
 *
 * exports ONLY tokenize, while exportNames reported all three. Proven against the runtime:
 * exportNames said "compile,toRPN,tokenize"; require() said "tokenize".
 *
 * WHY IT MATTERED MORE THAN IT LOOKS. agent.js:3868 shows its missing-export note only when
 * `!exportNames(...).has(want)`, and lostExports() is built on the same function. So a write that
 * shadowed its own exports produced NO note and NO loss warning - the hub declared it fine - and
 * the scorer reported "tokenize is not exported" long afterwards. That is the silent-failure
 * class: the work is gone and the instrument says OK.
 *
 * HOW THE SHAPE ARISES. qwen2.5:1.5b, given one narrow gate asking for two new functions plus an
 * updated export line, produced correct code 4 times out of 4 - and each time its FIND covered only
 * the function it was extending, so the ORIGINAL `module.exports = { tokenize };` survived and
 * landed after the new one. The model was right; edit composition shadowed it.
 *
 * THE ASSERTION IS AGAINST THE RUNTIME, deliberately. Every case below is written to disk and
 * require()d in a child process, and the test compares that to exportNames(). A hand-written
 * expectation could encode the same misunderstanding twice; the runtime cannot.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { exportNames, lostExports } from './defNames.js';

const dir = mkdtempSync(join(tmpdir(), 'expshadow-'));
let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${String(e.message).split('\n').slice(0, 4).join('\n        ')}`); }
};

/** What Node actually exports, as a sorted name list. */
const runtime = (src) => {
  const f = join(dir, 'm' + Math.random().toString(36).slice(2) + '.js');
  writeFileSync(f, src, 'utf8');
  const probe = join(dir, '_probe.js');
  writeFileSync(probe, 'const m = require(process.argv[2]);\n'
    + 'const ks = (m && typeof m === "object") ? Object.keys(m) : (typeof m === "function" && m.name ? [m.name] : []);\n'
    + 'console.log(ks.sort().join(","));', 'utf8');
  return String(execFileSync(process.execPath, [probe, f], { timeout: 15000 })).trim();
};
const statik = (src) => [...exportNames(src, 'x.js')].sort().join(',');

console.log('\nexportNames() must match the runtime, and the guards built on it must fire\n');

// ── THE DEFECT ────────────────────────────────────────────────────────────────────────────────
const SHADOWED = [
  'function tokenize(s) { return String(s).split(" ").filter(Boolean); }',
  'function toRPN(t) { return t; }',
  'function compile(s) { return toRPN(tokenize(s)); }',
  'module.exports = { tokenize, toRPN, compile };',
  'module.exports = { tokenize };',
].join('\n');

test('THE DEFECT: a later module.exports SHADOWS an earlier one', () => {
  assert.equal(statik(SHADOWED), 'tokenize');
  assert.equal(statik(SHADOWED), runtime(SHADOWED), 'static analysis disagrees with require()');
});

test('THE CONSEQUENCE: the missing-export note can now fire for a shadowed name', () => {
  // agent.js:3868 shows its note when !has(want). Both must be absent, or it stays silent.
  const have = exportNames(SHADOWED, 'x.js');
  assert.equal(have.has('toRPN'), false, 'toRPN reported as exported, so the note stays silent');
  assert.equal(have.has('compile'), false, 'compile reported as exported, so the note stays silent');
});

test('THE CONSEQUENCE: lostExports reports the shadowed names as lost', () => {
  const clean = SHADOWED.replace('\nmodule.exports = { tokenize };', '');
  assert.deepEqual(lostExports(clean, SHADOWED, 'x.js').sort(), ['compile', 'toRPN']);
});

// ── ORDER, both directions ────────────────────────────────────────────────────────────────────
test('the WIDER assignment wins when it comes last', () => {
  const src = 'function a(){}\nfunction b(){}\nmodule.exports = { a };\nmodule.exports = { a, b };';
  assert.equal(statik(src), 'a,b');
  assert.equal(statik(src), runtime(src));
});

test('an ANONYMOUS reassignment after a named one resets to nothing', () => {
  const src = 'function a(){}\nmodule.exports = { a };\nmodule.exports = function () {};';
  assert.equal(statik(src), '', 'a is still reported though the runtime no longer exports it');
  assert.equal(statik(src), runtime(src));
});

test('property adds AFTER a whole-object assignment accumulate', () => {
  const src = 'function a(){}\nfunction b(){}\nmodule.exports = { a };\nmodule.exports.b = b;';
  assert.equal(statik(src), 'a,b');
  assert.equal(statik(src), runtime(src));
});

test('a whole-object assignment AFTER property adds discards them', () => {
  const src = 'function a(){}\nfunction b(){}\nexports.a = a;\nmodule.exports = { b };';
  assert.equal(statik(src), 'b', 'a survived in the static view but not at runtime');
  assert.equal(statik(src), runtime(src));
});

// ── CONTROLS: the shapes that already worked must be untouched ─────────────────────────────────
for (const [name, src] of [
  ['single object assignment', 'function a(){}\nfunction b(){}\nmodule.exports = { a, b };'],
  ['bare identifier', 'function f(){}\nmodule.exports = f;'],
  ['named function value', 'module.exports = function add(a, b) { return a + b; };'],
  ['named class value', 'module.exports = class Library { constructor(){} };'],
  ['property adds only', 'function c(){}\nfunction r(){}\nmodule.exports.c = c;\nexports.r = r;'],
]) {
  test(`CONTROL (${name}) still matches the runtime`, () => {
    assert.equal(statik(src), runtime(src), 'static: ' + statik(src) + '  runtime: ' + runtime(src));
  });
}

test('CONTROL: a non-JS path still reports nothing', () => {
  assert.deepEqual([...exportNames('def f(x):\n    return x\n', 'a.py')], []);
});

try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
