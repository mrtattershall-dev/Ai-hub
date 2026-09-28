/**
 * emptyWrite.test.mjs - write_file must not report success for a file it did not write.
 *
 *   node server/emptyWrite.test.mjs
 *
 * THE DEFECT, measured 2026-09-13 while building the per-gate harness. qwen2.5:1.5b was shown a
 * template whose fence carried no language tag, so it emitted a bare fence and then opened its own
 * ```javascript fence inside it. parseAction read the empty FIRST pair as the content, and
 * write_file answered:
 *
 *     OK: wrote 0 bytes to s4_markdown.py
 *
 * Three files in one ten-goal run landed at 0 bytes with the tool reporting success. The gate above
 * them then reported "missing to_html", because an empty Python module imports perfectly well and
 * exposes nothing - so the visible symptom pointed at the model's code rather than at a write that
 * never happened.
 *
 * WHY THE EXISTING GUARD MISSES IT. The destructive-write check runs only `if (existsSync(full))`
 * and additionally requires `before.length > 400`. So creating a new empty file, or emptying a file
 * under 400 bytes, both pass. This is the same family as exportNames() reporting exports the runtime
 * does not have, and /api/health answering ok over a dead engine: the instrument reports success
 * while the work is gone.
 *
 * THE ESCAPE HATCH IS DELIBERATE. A refusal a caller cannot get past becomes a loop - this file has
 * that lesson written into edit_file's OCCURRENCE and the destructive guard's REMOVE:. So an empty
 * write is still possible with an explicit `EMPTY: yes`.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ws = mkdtempSync(join(tmpdir(), 'emptywrite-'));
process.env.AGENT_WORKSPACE = ws;
const { __toolPolicyTest: T } = await import('./agent.js');

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${String(e.message).split('\n').slice(0, 4).join('\n        ')}`); }
};

console.log('\nwrite_file must not report success for a file it did not write\n');

await test('THE DEFECT: an empty write to a NEW path is refused, not "OK: wrote 0 bytes"', async () => {
  const r = String(await T.callTool('write_file', { path: 'brand_new.js', content: '' }));
  assert.match(r, /^ERROR/, 'answered: ' + r.slice(0, 80));
  assert.match(r, /EMPTY/i);
  assert.equal(existsSync(join(ws, 'brand_new.js')), false, 'the file was created anyway');
});

await test('THE DEFECT: whitespace-only content is refused too', async () => {
  const r = String(await T.callTool('write_file', { path: 'ws_only.js', content: '   \n\t\n  ' }));
  assert.match(r, /^ERROR/, 'answered: ' + r.slice(0, 80));
});

await test('EXISTING FILE under 400 bytes: emptying it is refused and the bytes survive', async () => {
  const p = join(ws, 'small.js');
  const before = 'function add(a, b) { return a + b; }\nmodule.exports = { add };\n';
  writeFileSync(p, before, 'utf8');
  const r = String(await T.callTool('write_file', { path: 'small.js', content: '' }));
  assert.match(r, /^ERROR/, 'answered: ' + r.slice(0, 80));
  assert.equal(readFileSync(p, 'utf8'), before, 'the file was emptied despite the refusal');
});

await test('the refusal NAMES the byte count that would have been lost', async () => {
  const p = join(ws, 'named.js');
  writeFileSync(p, 'const a = 1;\n', 'utf8');
  const r = String(await T.callTool('write_file', { path: 'named.js', content: '' }));
  assert.match(r, /\d+ bytes/, 'no byte count in: ' + r.slice(0, 90));
});

await test('ESCAPE HATCH: EMPTY: yes really does write an empty file', async () => {
  const r = String(await T.callTool('write_file', { path: 'on_purpose.txt', content: '', empty: 'yes' }));
  assert.match(r, /^OK/, 'answered: ' + r.slice(0, 80));
  assert.equal(readFileSync(join(ws, 'on_purpose.txt'), 'utf8'), '');
});

// ── CONTROLS: ordinary writes must be completely unaffected ───────────────────────────────────
await test('CONTROL: a normal new file still writes', async () => {
  const r = String(await T.callTool('write_file', { path: 'normal.js', content: 'module.exports = { x: 1 };\n' }));
  assert.match(r, /^OK: wrote \d+ bytes/);
  assert.match(readFileSync(join(ws, 'normal.js'), 'utf8'), /module\.exports/);
});

await test('CONTROL: a one-character file is not "empty" and still writes', async () => {
  const r = String(await T.callTool('write_file', { path: 'tiny.txt', content: 'x' }));
  assert.match(r, /^OK/);
});

await test('CONTROL: a legitimate shrinking rewrite still lands', async () => {
  const p = join(ws, 'shrink.js');
  writeFileSync(p, 'function a(){}\n'.repeat(60), 'utf8');
  const r = String(await T.callTool('write_file', { path: 'shrink.js', content: 'function a(){ return 1; }\nmodule.exports = { a };\n' }));
  assert.match(r, /^OK/, 'answered: ' + r.slice(0, 90));
});

try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
