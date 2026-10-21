import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { acquireLease, admitted } from './resourceLease.mjs';
import { recoverInterrupted } from './autoRecover.mjs';
import { scratch, startHub } from './testHarness.mjs';

assert.equal(admitted({ramMB: 400, swapMB: 12000}, 'model'), false);
assert.equal(admitted({ramMB: 1800, swapMB: 0}, 'model'), false);
assert.equal(admitted({ramMB: 1800, swapMB: 12000}, 'model'), true);
const path = join(mkdtempSync(join(tmpdir(), 'lease-')), 'heavy.lock');
const first = await acquireLease('test', { path, checkMemory: false });
let acquired = false;
const second = acquireLease('test', { path, checkMemory: false }).then(r => { acquired = true; return r; });
await sleep(200); assert.equal(acquired, false, 'heavy jobs must serialize');
first(); (await second)();
const held = await acquireLease('test', { path, checkMemory: false });
const cancel = new AbortController();
const waiting = acquireLease('test', { path, checkMemory: false, signal: cancel.signal });
cancel.abort(); await assert.rejects(waiting); held();
(await acquireLease('test', { path, checkMemory: false }))();
console.log('PASS memory admission, exclusive lease, cancellation and release');
let resumed = 0;
const run = {status: 'interrupted', history: ['preserved']};
const opts = { healthy: async () => false, save: () => {}, resume: async () => resumed++ };
await recoverInterrupted(run, {...opts, now: 1});
await recoverInterrupted(run, {...opts, now: 31001});
assert.equal(resumed, 0); assert.equal(run.autoRecovery.attempts, 0);
await recoverInterrupted(run, {...opts, now: 62001, healthy: async () => true});
assert.equal(resumed, 1); assert.deepEqual(run.history, ['preserved']);
run.autoRecovery.attempts = 6;
await recoverInterrupted(run, {...opts, now: 999999, healthy: async () => true});
assert.equal(resumed, 1);
console.log('PASS recovery waits for health, preserves history and bounds retries');

let fail = true, calls = 0;
const server = createServer((req, res) => {
  if (!req.url.includes('/api/chat')) { res.setHeader('Content-Type', 'application/json'); res.end('{"models":[]}'); return; }
  req.resume(); req.on('end', () => {
    calls++;
    if (fail) { req.socket.destroy(); return; }
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.end(JSON.stringify({ message: { content: 'THOUGHT: Verified.\nACTION: finish\nSUMMARY: recovery test complete' }, done: true }) + '\n');
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const dir = scratch('auto-recover', {baseUrl: `http://127.0.0.1:${server.address().port}`});
mkdirSync(join(dir, 'workspace'));
writeFileSync(join(dir, 'workspace', 'package.json'), JSON.stringify({type:'module', scripts:{start:'node main.js',test:'node main.js'}}));
writeFileSync(join(dir, 'workspace', 'main.js'), 'console.log("hello");\n');
let h;
try {
  h = await startHub(dir, { env: { AGENT_AUTO_RECOVER: '1', AGENT_SUPERVISOR: '', WATCHERS: '', AGENT_APPROVAL_MODE: 'build', AGENT_MAX_STEPS: '4', MODEL_RETRIES: '1', AGENT_MAX_MINUTES: '5' } });
  const {runId} = await h.api('/agent/start', {method: 'POST', body: JSON.stringify({goal: 'Say hello, no files needed.'})});
  assert.ok(runId);
  let interrupted = false, finished = false;
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    const r = await h.api(`/agent/${runId}`);
    if (r.status === 'interrupted') { interrupted = true; fail = false; }
    if (r.status === 'done') { finished = true; assert.ok(r.autoRecovery.attempts >= 1); break; }
    await sleep(1000);
  }
  assert.equal(interrupted, true, h.log.join('').slice(-2000));
  assert.equal(finished, true, h.log.join('').slice(-2000));
  assert.ok(calls >= 2);
  console.log('PASS real hub resumes same run automatically after dropped Ollama connection');
} finally { h?.hub.kill(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
