/**
 * verifyExportsGoal.test.mjs - "verified" must mean the goal was met, not merely that the file ran.
 *
 *   node server/verifyExportsGoal.test.mjs
 *
 * THE DEFECT, found 2026-09-13 by firing a real goal at the hub rather than by reading code.
 *
 * Hub control run 1 (qwen15b-3OeQ4H): status done, verified TRUE, and the evidence line read
 *     "all 1 source file(s) pass a syntax check; `node add.js` ran and exited cleanly"
 * for a file containing only:
 *     function add(a, b) { return a + b; }
 * The goal was "Create add.js exporting a function add(a, b) that returns a + b." That file exports
 * NOTHING - require() returns {} - so the goal was not met, and the run was stamped verified anyway.
 *
 * Reproduced directly before writing this test:
 *     node --check add.js   -> passes (syntax only)
 *     node add.js           -> runs, exits 0
 *     require("./add.js")   -> exports: []
 * So for a node project verify_project's two checks are "it parses" and "it runs without crashing".
 * Both are satisfied by a file that does nothing the goal asked for. That is the silent-pass class
 * this project treats as its worst: a gate passing because it never asked the question that mattered.
 * It also explains the shape of the hub control - the loop is not merely failing to finish, it is
 * being TOLD it succeeded, and a model handed "verified" has no reason to keep working.
 *
 * THE RULE UNDER TEST IS DELIBERATELY NARROW. If the GOAL TEXT says "export(s|ing) NAME" and the entry
 * is a JS module, require() it and confirm NAME is actually exported. That mirrors
 * ledger.namedFiles(goal), which already parses FILENAMES out of goal text, so it introduces no new
 * class of inference. Anything broader would be a verifier guessing at intent, which is how a gate
 * starts producing confident wrong answers.
 *
 * NEIGHBOURING CONTRACT, deliberately left intact: verifyGoal.test.mjs pins that verify_project checks
 * the file the goal is about, in that file's language (set E - "`node q1_stock.js` ran and exited
 * cleanly" reported for a goal about q8_units.py). That is "the right file, run the right way". This is
 * "the result is what was asked for". Different questions, and the controls below keep the first one
 * working.
 *
 * RED-FIRST: verify() currently ignores any goal, so cases 1 and 2 FAIL today. Cases 3-6 are controls
 * that pass before and after - a fix that simply reported failure more often would satisfy the first
 * two and break these.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const verifier = await import('./verifyProject.js');

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};

/** A workspace with the CommonJS marker every real hub workspace has. */
const ws = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'vexp-'));
  writeFileSync(join(dir, 'package.json'),
    JSON.stringify({ name: 'agent-workspace', version: '0.0.0', private: true, type: 'commonjs' }, null, 2), 'utf8');
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body, 'utf8');
  return dir;
};

const NO_EXPORT = 'function add(a, b) {\n  return a + b;\n}\n';
const EXPORTED = 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n';
const BARE_FN = 'module.exports = function add(a, b) {\n  return a + b;\n};\n';
const GOAL_EXPORT = 'Create add.js exporting a function add(a, b) that returns a + b.';

console.log('\nverified must mean the goal was met, not merely that the file ran\n');

await test('THE BUG: a goal saying "exporting add" is NOT verified by a file that exports nothing', async () => {
  const dir = ws({ 'add.js': NO_EXPORT });
  const v = await verifier.verify(dir, { entry: 'add.js', goal: GOAL_EXPORT });
  assert.equal(v.ok, false,
    'verify() reported ok for a file that exports nothing, on a goal that asked for an export.\n'
    + '        evidence: ' + JSON.stringify(v.evidence || []));
});

await test('THE BUG: the failure names the missing export, so the model can act on it', async () => {
  const dir = ws({ 'add.js': NO_EXPORT });
  const v = await verifier.verify(dir, { entry: 'add.js', goal: GOAL_EXPORT });
  // `problems` is the field verify() actually returns, and the one that drives ok. The first draft of
  // this line read v.errors and v.verdict - neither exists - so it searched an empty string and failed
  // a fix that was already correct. A test that reads the wrong field is indistinguishable from a bug.
  const said = JSON.stringify([...(v.problems || []), ...(v.evidence || [])]);
  assert.match(said, /export/i, 'the verdict never mentions the export it is missing: ' + said.slice(0, 200));
});

await test('CONTROL: the same goal IS verified when the export is present (named property)', async () => {
  const dir = ws({ 'add.js': EXPORTED });
  const v = await verifier.verify(dir, { entry: 'add.js', goal: GOAL_EXPORT });
  assert.equal(v.ok, true, 'a correct file was refused: ' + JSON.stringify(v.evidence || v.errors || []));
});

await test('CONTROL: module.exports = fn counts too - both shapes are valid CommonJS', async () => {
  // [77]: demanding only the named-property form produced a false 0/5 against valid code.
  const dir = ws({ 'add.js': BARE_FN });
  const v = await verifier.verify(dir, { entry: 'add.js', goal: GOAL_EXPORT });
  assert.equal(v.ok, true, 'the bare-function export shape was refused: ' + JSON.stringify(v.evidence || v.errors || []));
});

await test('CONTROL: a goal that says nothing about exporting is unaffected', async () => {
  // The rule must fire ONLY on goals whose text asks for an export. A goal about running a script
  // must keep passing on the existing syntax+run evidence.
  const dir = ws({ 'add.js': NO_EXPORT });
  const v = await verifier.verify(dir, { entry: 'add.js', goal: 'Create add.js with a function that adds two numbers.' });
  assert.equal(v.ok, true, 'a goal with no export wording was failed by the export rule');
});

await test('CONTROL: with NO goal supplied at all, behaviour is exactly as before', async () => {
  // Every existing caller passes { entry } only. They must not start failing.
  const dir = ws({ 'add.js': NO_EXPORT });
  const v = await verifier.verify(dir, { entry: 'add.js' });
  assert.equal(v.ok, true, 'omitting goal changed the verdict - existing callers would break');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
