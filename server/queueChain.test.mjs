/**
 * queueChain.test.mjs - the unattended chain, end to end against a real server.
 *
 *   node server/queueChain.test.mjs
 *
 * Boots its own hub on a spare port rather than talking to yours, so running it while
 * something else is working is safe. It does share `agent-queue.json` (the path is fixed
 * in queue.js), so every goal it adds is tagged and deleted again on the way out - including
 * on failure. Check the queue is as you left it if this ever dies half way.
 *
 * What is actually being pinned: that a chain runs IN ORDER and only in order. `after`
 * existed in the queue from the start but nothing could set it, so this path has never
 * had a test - and "the queue released step 3 early" is a failure you would only ever
 * notice from a wrecked workspace hours later.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3099 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}/api`;
const TAG = `chaintest-${Date.now().toString(36)}`;

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const api = async (path, options) => {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

const goal = (n) => `${TAG} step ${n}`;

// ---- boot ---------------------------------------------------------------------------
const child = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), AGENT_SUPERVISOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });

async function waitForServer(deadlineMs = 20000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { if ((await fetch(BASE + '/health')).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start on ${PORT}\n${serverLog.slice(-800)}`);
}

async function cleanup() {
  try {
    const { body } = await api('/agent/queue');
    for (const item of (body.items || []).filter((i) => i.goal?.startsWith(TAG))) {
      await api(`/agent/queue/${item.id}`, { method: 'DELETE' });
    }
  } catch {}
  child.kill();
}

try {
  await waitForServer();

  // ---- the chain itself --------------------------------------------------------------
  let chain;
  await test('a chain queues every goal and links each to the one before', async () => {
    const { status, body } = await api('/agent/queue/chain', {
      method: 'POST',
      body: JSON.stringify({ goals: [goal(1), goal(2), goal(3)] }),
    });
    assert.equal(status, 200);
    assert.equal(body.queued.length, 3);
    assert.deepEqual(body.skipped, []);
    assert.equal(body.queued[0].after, null, 'the first link must not wait on anything');
    assert.equal(body.queued[1].after, body.queued[0].id);
    assert.equal(body.queued[2].after, body.queued[1].id);
    chain = body.queued;
  });

  await test('only the head of the chain is runnable; the rest report what they wait on', async () => {
    const { body } = await api('/agent/queue');
    const mine = body.items.filter((i) => i.goal.startsWith(TAG));
    assert.equal(mine.length, 3);
    assert.equal(mine[0].waitingOn, undefined, 'the head waits on nothing');
    assert.equal(mine[1].waitingOn, chain[0].id);
    assert.equal(mine[2].waitingOn, chain[1].id);
    for (const i of mine) assert.equal(i.blocked, undefined, 'a fresh chain is not blocked');
  });

  await test('a duplicate goal is skipped, and the chain closes the gap around it', async () => {
    const { body } = await api('/agent/queue/chain', {
      method: 'POST',
      body: JSON.stringify({ goals: [goal(2), goal(4), goal(5)] }),   // step 2 is already queued
    });
    assert.equal(body.queued.length, 2);
    assert.equal(body.skipped.length, 1);
    assert.ok(body.skipped[0].duplicate, 'the skip reason must say it was a duplicate');
    // step 4 is the first ACCEPTED goal of this call, so it must start a fresh chain
    // rather than inherit a link to the goal that was refused.
    assert.equal(body.queued[0].after, null);
    assert.equal(body.queued[1].after, body.queued[0].id);
  });

  // ---- guards -------------------------------------------------------------------------
  await test('an empty or missing goals array is refused', async () => {
    assert.equal((await api('/agent/queue/chain', { method: 'POST', body: '{}' })).status, 400);
    const empty = await api('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals: [] }) });
    assert.equal(empty.status, 400);
  });

  await test('a chain longer than the cap is refused whole, not silently truncated', async () => {
    const goals = Array.from({ length: 13 }, (_, i) => `${TAG} overflow ${i}`);
    const { status, body } = await api('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals }) });
    assert.equal(status, 400);
    assert.match(body.error, /capped at 12/);
    const { body: q } = await api('/agent/queue');
    assert.equal(q.items.filter((i) => i.goal.includes('overflow')).length, 0, 'a refused chain must queue nothing');
  });

  await test('POST /queue rejects an `after` that names no existing item', async () => {
    const { status, body } = await api('/agent/queue', {
      method: 'POST',
      body: JSON.stringify({ goal: `${TAG} orphan`, after: 'deadbeef' }),
    });
    assert.equal(status, 400);
    assert.match(body.error, /no queued item with id deadbeef/);
  });

  await test('a chained item whose predecessor is gone is reported as blocked, not just queued', async () => {
    await api(`/agent/queue/${chain[0].id}`, { method: 'DELETE' });   // delete the head
    const { body } = await api('/agent/queue');
    const orphaned = body.items.find((i) => i.id === chain[1].id);
    assert.ok(orphaned.blocked, 'an item waiting on a deleted predecessor must say so');
    assert.match(orphaned.blocked, /no longer exists/);
  });
} finally {
  await cleanup();
}

console.log(`queue chain: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
