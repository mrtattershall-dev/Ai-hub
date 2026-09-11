/**
 * appendFragment.test.mjs - append_file must not CREATE a file from a fragment.
 *
 *   node server/appendFragment.test.mjs
 *
 * Offline fuzzing (fuzzForever, batches 9-13) left exactly one kind of destroyed file behind:
 * q3_list.js, one version in its whole history, a fragment - the tail of an object the model
 * believed was already there ("Add helpers to the EXISTING q3_list.js", after an earlier goal
 * never created it). append_file created the file from that fragment. The end-of-run syntax
 * rollback restores the last version that parsed, and a file born broken never had one.
 *
 * The rule pinned here: a NEW .js/.py created by append must parse on its own, or nothing is
 * written. Everything else append_file does is unchanged - pinned too, so the fix cannot
 * quietly widen into refusing ordinary appends.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ws = mkdtempSync(join(tmpdir(), 'appendfrag-'));
process.env.AGENT_WORKSPACE = ws;
const { __toolPolicyTest } = await import('./agent.js');
const append = (path, content) => __toolPolicyTest.appendFile({ path, content });

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

// The fragment the fuzzer kept finding, verbatim in shape.
const FRAGMENT = '  function zip(a, b) {\n    return a.map((val, i) => [val, b[i]]);\n  }\n};\n';

console.log('\nappend_file: a fragment is not a file\n');

await test('a fragment appended to a MISSING .js is refused, and nothing is written', async () => {
  const r = await append('q3_list.js', FRAGMENT);
  assert.match(r, /^ERROR:/, 'not refused: ' + r.slice(0, 120));
  assert.ok(!existsSync(join(ws, 'q3_list.js')), 'the fragment was left on disk');
});

await test('the refusal tells the model the file does not exist, and what to do instead', async () => {
  const r = await append('q3_list.js', FRAGMENT);
  assert.match(r, /does not exist/);
  assert.match(r, /write_file/);
  assert.match(r, /SyntaxError|Unexpected/, 'the syntax error itself is not shown');
});

await test('a COMPLETE file appended to a missing .js is still created (unchanged)', async () => {
  const body = 'function add(a, b) { return a + b; }\nmodule.exports = { add };\n';
  const r = await append('fresh.js', body);
  assert.match(r, /^OK:/, r.slice(0, 120));
  assert.equal(readFileSync(join(ws, 'fresh.js'), 'utf8'), body);
});

await test('appending a fragment to an EXISTING .js still appends (unchanged)', async () => {
  writeFileSync(join(ws, 'have.js'), 'const list = {\n');
  const r = await append('have.js', FRAGMENT);
  assert.match(r, /^OK: appended/, r.slice(0, 120));
  assert.equal(readFileSync(join(ws, 'have.js'), 'utf8'), 'const list = {\n' + FRAGMENT);
});

await test('a missing file in a language the checker does not know is still created (unchanged)', async () => {
  const r = await append('NOTES.md', '## zip\n- pairs two arrays\n');
  assert.match(r, /^OK:/, r.slice(0, 120));
  assert.ok(existsSync(join(ws, 'NOTES.md')));
});

await test('a broken fragment for a missing .py is refused too', async () => {
  const r = await append('frag.py', '    return s.lower()\n  x = (\n');
  // With python on PATH this is a real IndentationError/SyntaxError -> refused. Without it,
  // quickCheck cannot tell, and the rule is to NOT refuse on a missing interpreter.
  if (/^OK:/.test(r)) { console.log('        (python not on PATH - created, as designed)'); return; }
  assert.match(r, /^ERROR:/);
  assert.ok(!existsSync(join(ws, 'frag.py')), 'the fragment was left on disk');
});

await test('nothing stray is left in the workspace by a refusal', async () => {
  const left = readdirSync(ws).filter((f) => !['fresh.js', 'have.js', 'NOTES.md', '__pycache__', 'frag.py'].includes(f));
  assert.deepEqual(left, [], 'unexpected files: ' + left.join(', '));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
