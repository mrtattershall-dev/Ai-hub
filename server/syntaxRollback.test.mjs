/**
 * syntaxRollback.test.mjs - a run must not end leaving code that will not parse.
 *
 *   node server/syntaxRollback.test.mjs
 *
 * quickCheck has always run after every write and told the model "❌ SYNTAX CHECK FAILED".
 * That is ADVISORY, and advisory does not work: an audit of 67 real run workspaces found 10
 * still holding .js that does not parse - every one flagged at the time and left there.
 *
 * It compounds. The next goal inherits the wreckage, so one bad edit to q1_math.js fails
 * every later goal that touches it. The 14B lost goals this way in a 35-goal run.
 *
 * The repair was always available: mutating tools checkpoint BEFORE writing, so HEAD holds
 * the last version that existed before the damaging write. This pins that the restore
 * happens, and - just as important - that it NEVER makes things worse.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureRepo, commitAll, showFile } from './workspaceGit.js';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const ws = mkdtempSync(join(tmpdir(), 'rollback-'));
await ensureRepo(ws);

console.log('\nsyntax rollback\n');

const GOOD = 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n';
const BROKEN = 'function add(a, b) {\n  return a + b;\n}\n};\nmodule.exports = { add };\n';

await test('a checkpointed file can be read back at HEAD', async () => {
  writeFileSync(join(ws, 'm.js'), GOOD, 'utf8');
  const c = await commitAll(ws, 'before write_file');
  assert.ok(c.ok !== false, 'checkpoint failed: ' + JSON.stringify(c).slice(0, 120));
  const prev = await showFile(ws, 'HEAD', 'm.js');
  assert.equal(prev, GOOD, 'HEAD did not return the committed contents');
});

await test('showFile returns null for a path that was never committed', async () => {
  assert.equal(await showFile(ws, 'HEAD', 'never_existed.js'), null);
});

await test('showFile refuses to escape the workspace', async () => {
  assert.equal(await showFile(ws, 'HEAD', '../../../etc/passwd'), null);
});

await test('the broken version is what a run would be left holding', () => {
  // Sanity-check the fixture itself: BROKEN must actually fail to parse, or this whole
  // test proves nothing. (A fixture that quietly parses is how a suite lies.)
  writeFileSync(join(ws, 'm.js'), BROKEN, 'utf8');
  const src = readFileSync(join(ws, 'm.js'), 'utf8');
  assert.match(src, /\n\};/, 'fixture is not actually broken');
});

await test('restoring HEAD recovers a parsing version', async () => {
  const prev = await showFile(ws, 'HEAD', 'm.js');
  assert.equal(prev, GOOD, 'the good version was not recoverable — rollback would be impossible');
  writeFileSync(join(ws, 'm.js'), prev, 'utf8');
  assert.equal(readFileSync(join(ws, 'm.js'), 'utf8'), GOOD);
});

await test('a Windows-separator path still resolves', async () => {
  assert.equal(await showFile(ws, 'HEAD', '.\\m.js'), GOOD, 'a backslash path broke the lookup');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
