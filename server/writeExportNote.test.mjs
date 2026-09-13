/**
 * writeExportNote.test.mjs - the note after a WRITE must say when the goal's export is missing.
 *
 *   node server/writeExportNote.test.mjs
 *
 * WHY THIS EXISTS, measured 2026-09-13 on a real hub run (qwen15b, level 1, 20-minute wall):
 * the model wrote `function add(a, b) { return a + b; }` - 53 bytes, no export - EIGHT times, and after
 * every single one the hub answered
 *     OK: wrote 53 bytes to add.js
 *     ✅ add.js passed a syntax check.
 * Its own plan DID include `ACTION: verify_project`, which would have said "does not export `add`" -
 * but that action sat in position 2 of a multi-action reply and the hub discards everything after the
 * first, so the model never once saw it. The only message it is GUARANTEED to read said green.
 *
 * So the export check belongs in that guaranteed message. This is the same "show the shape at the
 * moment of the decision" rule the gate loop measured: stating the CommonJS rule in prose scored 0/5
 * twice, showing the literal closing line worked.
 *
 * DELIBERATELY NARROW, because the opposite error is worse. A false warning on correct code blocks real
 * work and teaches the model to fight the tool - that direction already produced a false 0/5 tonight.
 * So it fires ONLY when the goal names an export, the file is JS, and that name is genuinely absent.
 */
import assert from 'node:assert/strict';
import { exportNames } from './defNames.js';
import { exportedName } from './verifyProject.js';

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 3).join('\n        ')); } };

/** The note the write path should append. Pure so it can be tested without a run. */
const exportNote = (goal, src, path) => {
  const want = exportedName(goal);
  if (!want || !/\.(c|m)?js$/i.test(path || '')) return '';
  let have = new Set();
  try { have = exportNames(src, path) || new Set(); } catch { return ''; }
  if (have.has(want)) return "";
  return `\n\n⚠️ ${path} does not export \`${want}\`, which the goal asks for. It parses and it runs, but `
    + `require('./${path}') gives {} - so nothing can use it and the goal is NOT met. End the file with:\n`
    + `module.exports = { ${want} };`;
};

const GOAL = 'Create add.js exporting a function add(a, b) that returns a + b.';
const NO_EXPORT = 'function add(a, b) {\n  return a + b;\n}\n';
const EXPORTED = NO_EXPORT + 'module.exports = { add };\n';

console.log('\nthe guaranteed post-write message must name a missing export\n');

test('THE BUG: the exact file the real run wrote 8 times gets a warning', () => {
  const n = exportNote(GOAL, NO_EXPORT, 'add.js');
  assert.match(n, /does not export/, 'no warning at all: ' + JSON.stringify(n));
});
test('THE BUG: it names the export AND shows the literal line to add', () => {
  const n = exportNote(GOAL, NO_EXPORT, 'add.js');
  assert.match(n, /`add`/, 'does not name the export');
  assert.match(n, /module\.exports = \{ add \};/, 'does not SHOW the shape - stating the rule scored 0/5 twice');
});
test('CONTROL: a correct file gets NO warning', () => {
  assert.equal(exportNote(GOAL, EXPORTED, 'add.js'), '', 'warned about a correct file');
});
test('CONTROL: a goal that never mentions exporting gets NO warning', () => {
  assert.equal(exportNote('Create add.js with a function that adds two numbers.', NO_EXPORT, 'add.js'), '');
});
test('CONTROL: a .py file gets NO warning (module.exports is meaningless there)', () => {
  assert.equal(exportNote('Create add.py exporting a function add(a, b).', 'def add(a,b):\n  return a+b\n', 'add.py'), '');
});
test('CONTROL: module.exports = function add  counts as exporting add', () => {
  const n = exportNote(GOAL, 'module.exports = function add(a, b) { return a + b; };\n', 'add.js');
  assert.equal(n, '', 'refused the bare-function export shape: ' + n);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
