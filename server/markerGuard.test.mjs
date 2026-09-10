/**
 * markerGuard.test.mjs - the workspace boundary marker is not the agent's to rewrite.
 *
 *   node server/markerGuard.test.mjs
 *
 * THE BUG THIS PINS, traced end to end 2026-09-10 and caused by the hub itself:
 *
 *   edit_file  package.json -> ERROR: the FIND snippet was not found in package.json.
 *                              Copy the target lines EXACTLY ... OR USE write_file
 *                              TO REPLACE THE WHOLE FILE.
 *   write_file package.json -> OK: wrote 22 bytes
 *
 * The model wanted `"type": "module"` for the ESM it had just written. Its edit missed, and
 * our own error message pointed it at the destructive route - so the 8-line marker became a
 * 22-byte `{"type":"module"}` stub.
 *
 * Two things then broke SILENTLY, which is why this went unnoticed for hours. The marker
 * exists to stop npm/node/tsc walking up into the hub's own project, and that protection was
 * simply gone. And the system prompt states "the workspace is a CommonJS Node project" as a
 * FACT - now false, so every instruction built on it misled the model. Measured across four
 * consecutive run workspaces: `type` was `module` in TWO of them, each internally
 * consistent, which is exactly why nothing looked wrong.
 *
 * The prompt already told the model not to do this and it did it anyway. That is the
 * advisory-vs-mechanical lesson one level down: only a guard can hold it, so the guard is
 * what gets tested.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the module at a scratch workspace before importing it, so importing agent.js can
// never touch live state (it creates/reads WORKSPACE at module scope).
process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'markerguard-'));
const { __toolPolicyTest } = await import('./agent.js');
const refuse = __toolPolicyTest.markerRefusal;

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

console.log('\nworkspace boundary marker\n');

test('write_file on package.json is REFUSED', () => {
  const r = refuse('package.json', 'write_file');
  assert.ok(r, 'write_file to the marker was allowed - this is the exact call that destroyed it');
  assert.match(r, /^ERROR:/, 'refusal must read as an error the run loop surfaces');
  assert.match(r, /write_file/, 'the refusal should name the tool that was refused');
});

test('edit_file on package.json is REFUSED', () => {
  const r = refuse('package.json', 'edit_file');
  assert.ok(r, 'edit_file to the marker was allowed');
  assert.match(r, /edit_file/);
});

test('the refusal explains WHY, so the model does not simply retry', () => {
  const r = refuse('package.json', 'write_file');
  // A bare "not allowed" reads as "try harder" to a small model - which is how the FIND
  // error produced an overwrite in the first place.
  assert.match(r, /boundary marker/i, 'must say what the file IS');
  assert.match(r, /commonjs/i, 'must state the module system, since wanting ESM is the motive');
  assert.match(r, /\.mjs/i, 'must offer the legitimate route to ESM');
});

test('the refusal tells it to get back to the goal', () => {
  const r = refuse('package.json', 'write_file');
  assert.match(r, /carry on|actual work|nothing about your goal/i,
    'without this the model has a refusal and no next move');
});

test('./package.json and backslash paths are caught too', () => {
  assert.ok(refuse('./package.json', 'write_file'), 'a ./ prefix slipped past the guard');
  assert.ok(refuse('.\\package.json', 'write_file'), 'a Windows-separator path slipped past the guard');
});

test('ORDINARY files are untouched - the guard must not block real work', () => {
  for (const p of ['index.html', 'p1_calc.js', 'src/package.json.bak', 'notes/package.json.md']) {
    assert.equal(refuse(p, 'write_file'), null, `${p} was wrongly refused`);
  }
});

test('a nested package.json in a subproject is NOT the workspace marker', () => {
  // Only the workspace ROOT marker is protected. A goal that legitimately scaffolds a
  // sub-package must still be able to write its own package.json.
  assert.equal(refuse('subproject/package.json', 'write_file'), null,
    'a nested package.json was refused - that blocks legitimate scaffolding');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
