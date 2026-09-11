/**
 * tracesIsolation.test.mjs - test and fuzz hubs must not write the training corpus.
 *
 *   node server/tracesIsolation.test.mjs
 *
 * server/agent-traces/traces.jsonl is TRAINING data (goal -> plan -> code). saveTrace wrote
 * it to a hard-coded path, so every isolated test hub and every offline fuzz run appended
 * replayed mock output to it: 359 committed rows became 2,000+ in a day, and no row said
 * which model wrote it, so the garbage could not be separated afterwards.
 *
 * Pinned here: AGENT_TRACES_DIR moves the file; the repo's corpus is untouched when it is
 * set; every row now names its provider, model and source; and every mock harness that
 * isolates the run index also isolates traces (the same leak has now happened twice -
 * RUN_INDEX's own comment records the first).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), 'tracesiso-'));
process.env.AGENT_WORKSPACE = join(TMP, 'workspace');
process.env.AGENT_QUEUE_FILE = join(TMP, 'queue.json');
process.env.AGENT_RUNS_DIR = join(TMP, 'runs');
process.env.RUN_INDEX = join(TMP, 'run-index.jsonl');
process.env.AGENT_TRACES_DIR = join(TMP, 'traces');

const REPO_TRACES = join(HERE, 'agent-traces', 'traces.jsonl');
const sizeOf = (f) => (existsSync(f) ? statSync(f).size : -1);
const repoBefore = sizeOf(REPO_TRACES);

const { __toolPolicyTest } = await import('./agent.js');
const { isolatedEnv } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

console.log('\ntraces: isolated, and self-describing\n');

const fakeRun = {
  id: 'tr-1', status: 'done', goal: 'Create t.js', plan: null, followups: [],
  provider: 'ollama', model: 'coder14b', source: 'supervisor',
  steps: [{ type: 'tool', tool: 'write_file', args: { path: 't.js', content: 'module.exports = 1;\n' } }],
};

await test('AGENT_TRACES_DIR moves the trace file', async () => {
  __toolPolicyTest.saveTrace(fakeRun);
  const f = join(TMP, 'traces', 'traces.jsonl');
  assert.ok(existsSync(f), 'no trace written under AGENT_TRACES_DIR');
  assert.equal(readFileSync(f, 'utf8').trim().split('\n').length, 1);
});

await test('the repo training corpus is untouched when it is set', async () => {
  assert.equal(sizeOf(REPO_TRACES), repoBefore, 'server/agent-traces/traces.jsonl changed size');
});

await test('each row names its run id, provider, model and source', async () => {
  const row = JSON.parse(readFileSync(join(TMP, 'traces', 'traces.jsonl'), 'utf8').trim());
  assert.equal(row.id, 'tr-1');
  assert.equal(row.provider, 'ollama');
  assert.equal(row.model, 'coder14b');
  assert.equal(row.source, 'supervisor');
  assert.equal(row.code[0].path, 't.js', 'the training payload itself went missing');
});

await test('a run with no model call records model:null, not a crash or a guess', async () => {
  __toolPolicyTest.saveTrace({ id: 'tr-2', status: 'stopped', goal: 'g', steps: [] });
  const rows = readFileSync(join(TMP, 'traces', 'traces.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const r = rows.find((x) => x.id === 'tr-2');
  assert.ok(r, 'row missing');
  assert.equal(r.model, null);
  assert.equal(r.source, 'human');
});

await test('testHarness.isolatedEnv isolates traces with everything else', async () => {
  const env = isolatedEnv(join(TMP, 'h'), 1234);
  assert.ok(env.AGENT_TRACES_DIR, 'isolatedEnv has no AGENT_TRACES_DIR');
  assert.ok(env.AGENT_TRACES_DIR.startsWith(join(TMP, 'h')), 'traces not under the isolated dir');
});

await test('every MOCK harness that isolates RUN_INDEX also isolates traces', async () => {
  // Real-model harnesses (real*, soak, *Agent.mjs, prove7b) are EXEMPT on purpose: their
  // output is genuine model work and belongs in the corpus.
  const REAL = /^(real|soak|prove7b|fullAgent|gameAgent|varianceAgent|yoloAgent)/;
  const offenders = readdirSync(HERE)
    .filter((f) => /\.(test\.)?mjs$/.test(f) && !REAL.test(f) && f !== 'runIndex.mjs' && f !== 'tracesIsolation.test.mjs')
    .filter((f) => {
      const src = readFileSync(join(HERE, f), 'utf8');
      return /RUN_INDEX/.test(src) && !/AGENT_TRACES_DIR/.test(src);
    });
  assert.deepEqual(offenders, [], 'these still write the training corpus: ' + offenders.join(', '));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
