/**
 * teardownSettles.test.mjs - a run is not over until its teardown is over.
 *
 *   node server/teardownSettles.test.mjs
 *
 * The syntax rollback lives in drive()'s `finally`, and the first line of that block was
 * `run.busy = false`. So the instant a run's status turned terminal the hub told every client
 * it was finished AND released the workspace lock - while the rollback was still walking git
 * history to repair the file the run had broken.
 *
 * Found by `fuzzLoop.mjs 1 4 14`: "BROKEN: p1_calc.js does not parse", although p1_calc.js's
 * history held a version that parsed - replaying the rollback on a copy of that workspace
 * restored it in 1.2s. The fuzzer had seen 'stopped', checked the workspace and killed the
 * hub mid-teardown; the run file on disk still said 'running'. Outside the fuzzer the same
 * gap lets /agent/start accept the next goal while the previous run's rollback is still
 * rewriting files underneath it.
 *
 * This drives a real hub with a scripted model: write m.js that parses, overwrite it with
 * one that does not, run out of step budget. It polls as fast as it can and asserts that the
 * FIRST time the hub reports the run terminal and not busy, m.js on disk already parses.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scratch, startHub, freePorts } from './testHarness.mjs';

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const GOOD = 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n';
const BROKEN = 'function add(a, b) {\n  return a + b;\n}\n};\nmodule.exports = { add };\n';
const fence = (code) => '```javascript\n' + code + '```';
// Call 1 is the planner. Calls 2 and 3 are the loop, which AGENT_MAX_STEPS=2 then stops.
const REPLIES = [
  'PLAN:\n1. Write m.js exporting add(a, b).',
  `THOUGHT: Create m.js.\nACTION: write_file\nPATH: m.js\n${fence(GOOD)}`,
  `THOUGHT: Extend m.js.\nACTION: write_file\nPATH: m.js\n${fence(BROKEN)}`,
];

const [mockPort, hubPort] = await freePorts(2);
let served = 0;
const mock = createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"engine":"mock","lora":null}');
  }
  let b = ''; req.on('data', (d) => { b += d; });
  req.on('end', () => {
    const text = REPLIES[Math.min(served++, REPLIES.length - 1)];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'fake', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((ok) => mock.listen(mockPort, '127.0.0.1', ok));

const dir = scratch('teardown', { baseUrl: `http://127.0.0.1:${mockPort}` });
const { hub, api, log } = await startHub(dir, {
  port: hubPort,
  env: { AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', AGENT_MAX_STEPS: '2', AGENT_MAX_MINUTES: '3',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
});
const mPath = join(dir, 'workspace', 'm.js');
const snapDir = mkdtempSync(join(tmpdir(), 'teardown-snap-'));
// Parse a SNAPSHOT, not the live file: the rollback may rewrite m.js while node --check runs.
const parses = (src) => {
  const p = join(snapDir, 'snap.js'); writeFileSync(p, src, 'utf8');
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); return true; } catch { return false; }
};

console.log('\nteardown settles before the run reports itself finished\n');

let runId = null;
let first = null;       // what the hub said, and what was on disk, the first time it said "finished"
await test('a run starts', async () => {
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create m.js exporting add(a,b).' }) });
  assert.ok(s.runId, 'no run id: ' + JSON.stringify(s).slice(0, 200));
  runId = s.runId;
});

await test('the hub eventually reports the run finished', async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const r = await api('/agent/' + runId);
    if (['done', 'error', 'stopped'].includes(r.status) && r.busy !== true) {
      let src = null; try { src = readFileSync(mPath, 'utf8'); } catch { /* reported below */ }
      first = { run: r, src };
      break;
    }
    await new Promise((ok) => setTimeout(ok, 5));
  }
  assert.ok(first, 'never reached a terminal, non-busy state within 120s');
});

await test('fixture: the run wrote m.js twice and ran out of budget', () => {
  // A fixture that never breaks m.js would pass the real assertion below for nothing.
  const writes = (first.run.steps || []).filter((s) => s.tool === 'write_file' && /^OK/.test(String(s.result)));
  assert.equal(writes.length, 2, 'expected two successful write_file steps: '
    + (first.run.steps || []).map((s) => s.tool || s.type).join(' -> '));
  assert.equal(first.run.status, 'stopped');
  assert.equal(parses(BROKEN), false, 'BROKEN fixture actually parses');
});

await test('when the hub first says the run is over, m.js already parses', () => {
  assert.ok(first.src != null, 'm.js missing at that moment');
  assert.ok(parses(first.src),
    'the hub reported the run terminal and not busy while m.js still did not parse - clients were told '
    + `it was finished before the syntax rollback ran. m.js was:\n${first.src}`);
});

await test('and the rollback says so in the run', async () => {
  const r = await api('/agent/' + runId);
  assert.ok((r.steps || []).some((s) => s.type === 'note' && /m\.js did not parse/.test(s.text || '')),
    'no rollback note in the steps');
  assert.ok(parses(readFileSync(mPath, 'utf8')), 'm.js still does not parse after teardown');
});

hub.kill(); mock.close();
if (failed) console.log('\n--- hub log tail ---\n' + log.join('').split('\n').slice(-20).join('\n'));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
