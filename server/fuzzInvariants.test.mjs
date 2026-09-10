/**
 * fuzzInvariants.test.mjs - does each fuzz check actually FIRE?
 *
 *   node server/fuzzInvariants.test.mjs
 *
 * fuzzLoop.mjs reporting "40/40 clean" is only worth anything if every check it runs is
 * known to go red on the damage it names. The first version of mockLoop's marker check passed
 * with the marker guard switched off, because the attack never reached the tool. So: build
 * one deliberately corrupted run directory per violation kind, and assert that kind - and
 * ONLY that kind - is reported. Plus one clean directory that must report nothing, so the
 * checker cannot pass by flagging everything.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkInvariants } from './fuzzInvariants.mjs';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const GOOD_MARKER = JSON.stringify({
  name: 'agent-workspace', version: '0.0.0', private: true, type: 'commonjs',
  description: 'Boundary marker. Stops npm/node/tsc walking up into the hub project.',
}, null, 2);

// A healthy run directory: marker intact, code that parses, valid run and index files.
function healthy() {
  const dir = mkdtempSync(join(tmpdir(), 'inv-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  mkdirSync(join(dir, 'runs'), { recursive: true });
  writeFileSync(join(ws, 'package.json'), GOOD_MARKER, 'utf8');
  writeFileSync(join(ws, 'ok.js'), 'function add(a, b) { return a + b; }\nmodule.exports = { add };\n', 'utf8');
  writeFileSync(join(dir, 'hub.json'), '{}', 'utf8');
  writeFileSync(join(dir, 'runs', 'r1.json'), JSON.stringify({ id: 'r1', status: 'done' }), 'utf8');
  writeFileSync(join(dir, 'index.jsonl'), JSON.stringify({ id: 'r1' }) + '\n', 'utf8');
  return { dir, ws };
}
const kinds = (v) => [...new Set(v.map((x) => x.split(':')[0]))].sort();

console.log('\nfuzz invariants\n');

test('a healthy run directory reports NOTHING', () => {
  // Without this, a checker that flags everything would pass every test below.
  const { dir } = healthy();
  const v = checkInvariants(dir);
  assert.deepEqual(v, [], `clean directory flagged: ${v.join(' | ')}`);
});

test('CRASH fires when the hub exited', () => {
  const { dir } = healthy();
  assert.deepEqual(kinds(checkInvariants(dir, { hubExitCode: 1, hubLog: 'TypeError: boom' })), ['CRASH']);
});

test('a hub still running (exitCode null) is NOT a crash', () => {
  const { dir } = healthy();
  assert.deepEqual(checkInvariants(dir, { hubExitCode: null }), []);
});

test('an invalid-JSON marker breaks EVERY .js file, not just itself', () => {
  // This test first expected ['MARKER'] alone and got ['BROKEN', 'MARKER'] - and the checker
  // was right. `node --check` reads the nearest package.json to decide the module type, so
  // when the marker is not valid JSON, node refuses every .js file in the workspace, including
  // ok.js, which is perfectly valid code. A destroyed marker does not damage one file; it
  // takes the whole workspace down with it. That is why it mattered that 9 of 67 real
  // workspaces had one, and why the guard refuses writes to it outright.
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'package.json'), '{"type":"module"', 'utf8');   // truncated, as seen
  assert.deepEqual(kinds(checkInvariants(dir)), ['BROKEN', 'MARKER']);
});

test('MARKER fires on the 22-byte {"type":"module"} stub', () => {
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'package.json'), '{"type":"module"}', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['MARKER']);
});

test('BROKEN fires on code that does not parse', () => {
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'bad.js'), 'function add(a, b) {\n  return a + b;\n}\n};\n', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['BROKEN']);
});

test('ESM code in a commonjs workspace is ESM, NOT broken', () => {
  // Valid code, wrong module system. Lumping it in with unparseable code made the fuzz report
  // look like the rollback was failing when the file was never broken at all.
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'esm.js'), "import { add } from './ok.js';\nconsole.log(add(1, 2));\n", 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['ESM']);
});

test('STRAY fires on a file written beside the workspace', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'index.html'), '<h1>landed in the wrong place</h1>', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['STRAY']);
});

test('the harness\'s own .bak/.tmp files are NOT strays', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'hub.json.bak'), '{}', 'utf8');
  writeFileSync(join(dir, 'queue.json.tmp'), '[]', 'utf8');
  assert.deepEqual(checkInvariants(dir), []);
});

test('GIT fires when the workspace .git is not a usable repo of its own', () => {
  // Honest scope: this exercises the "cannot resolve" branch. Reproducing the original bug -
  // a workspace resolving to an ENCLOSING repo - needs the hub's own checkout around it,
  // which a temp dir cannot fake without escaping the ceiling the check itself sets.
  const { dir, ws } = healthy();
  mkdirSync(join(ws, '.git'), { recursive: true });                      // empty = not a repo
  assert.deepEqual(kinds(checkInvariants(dir)), ['GIT']);
});

test('RUNFILE fires on a truncated persisted run', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'runs', 'r2.json'), '{"id":"r2","status":"do', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['RUNFILE']);
});

test('INDEX fires on a run-index line that no longer parses', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'index.jsonl'), JSON.stringify({ id: 'r1' }) + '\n{"id":"r2",\n', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['INDEX']);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
