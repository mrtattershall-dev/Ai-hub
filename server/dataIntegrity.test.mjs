/**
 * dataIntegrity.test.mjs - corruption must never be laundered into data loss.
 *
 *   node server/dataIntegrity.test.mjs
 *
 * Three loaders (hub.json, agent-queue.json, assets/manifest.json) read an unparseable
 * file as EMPTY. Every caller is load -> mutate -> save, so the next save wrote that
 * emptiness over the real data: API keys, conversation history, the unattended backlog,
 * and the index for ~13,000 asset files. The corruption did not destroy the data - the
 * recovery did, silently.
 *
 * These pin the new rule: a MISSING file means empty; a file that exists but will not
 * parse is an emergency, and the original is preserved either way.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { readJsonSafe, refreshBackup } = await import('./safeJson.js');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'hubint-'));
const fresh = (name, body) => {
  const f = join(dir, name);
  if (body !== undefined) writeFileSync(f, body, 'utf8');
  return f;
};
const corruptCopies = (f) => readdirSync(dir).filter((n) => n.startsWith(f.split(/[\\/]/).pop() + '.corrupt-'));

console.log('\ndata integrity\n');

test('a MISSING file is normal and means empty', () => {
  const out = readJsonSafe(join(dir, 'nope.json'), { empty: { items: [] } });
  assert.deepEqual(out, { items: [] });
});

test('a valid file parses', () => {
  const f = fresh('good.json', JSON.stringify({ items: [1, 2, 3] }));
  assert.deepEqual(readJsonSafe(f, { empty: { items: [] } }), { items: [1, 2, 3] });
});

test('a CORRUPT file is never reported as empty (throw mode)', () => {
  const f = fresh('keys.json', '{"api_keys": {"openai": {"key_value": "sk-rea');   // truncated
  assert.throws(
    () => readJsonSafe(f, { empty: { api_keys: {} }, label: 'hub.json', onUnrecoverable: 'throw' }),
    /not valid JSON|Refusing to start/,
  );
});

test('the damaged file is PRESERVED, not overwritten', () => {
  const body = '{"api_keys": {"openai": {"key_value": "sk-precious';
  const f = fresh('precious.json', body);
  try { readJsonSafe(f, { empty: {}, onUnrecoverable: 'throw' }); } catch {}
  const kept = corruptCopies(f);
  assert.equal(kept.length, 1, `expected one quarantined copy, found ${kept.length}`);
  assert.equal(readFileSync(join(dir, kept[0]), 'utf8'), body, 'quarantined copy does not match the original');
});

test('a good .bak rescues a corrupt file', () => {
  const f = fresh('withbak.json', '{"api_keys": {"broke');
  writeFileSync(f + '.bak', JSON.stringify({ api_keys: { openai: { key_value: 'sk-saved' } } }), 'utf8');
  const out = readJsonSafe(f, { empty: { api_keys: {} }, tryBak: true, onUnrecoverable: 'throw' });
  assert.equal(out.api_keys.openai.key_value, 'sk-saved', 'did not recover from .bak');
});

test('quarantine mode continues empty but keeps the original', () => {
  const f = fresh('queue.json', '{"items": [{"goal": "build the thi');
  const out = readJsonSafe(f, { empty: { items: [] }, onUnrecoverable: 'quarantine' });
  assert.deepEqual(out, { items: [] }, 'should continue with an empty backlog');
  assert.equal(corruptCopies(f).length, 1, 'the damaged backlog was not preserved');
  assert.ok(!existsSync(f), 'the damaged file should be moved aside so a save cannot clobber it');
});

test('the empty value is a COPY, so callers cannot poison the default', () => {
  const e = { items: [] };
  const a = readJsonSafe(join(dir, 'absent1.json'), { empty: e });
  a.items.push('mutated');
  const b = readJsonSafe(join(dir, 'absent2.json'), { empty: e });
  assert.deepEqual(b.items, [], 'the shared empty default was mutated by a previous caller');
});

// ── the backup rule ──────────────────────────────────────────────────────────
test('refreshBackup will not overwrite a good .bak with a corrupt file', () => {
  const f = fresh('rb.json', '{"broken');
  writeFileSync(f + '.bak', JSON.stringify({ good: true }), 'utf8');
  refreshBackup(f);
  assert.deepEqual(JSON.parse(readFileSync(f + '.bak', 'utf8')), { good: true },
    'a corrupt current file destroyed the last known-good backup');
});

test('refreshBackup does update the .bak from a valid file', () => {
  const f = fresh('rb2.json', JSON.stringify({ v: 2 }));
  writeFileSync(f + '.bak', JSON.stringify({ v: 1 }), 'utf8');
  refreshBackup(f);
  assert.deepEqual(JSON.parse(readFileSync(f + '.bak', 'utf8')), { v: 2 }, 'backup did not advance');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
