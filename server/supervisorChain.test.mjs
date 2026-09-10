/**
 * supervisorChain.test.mjs - the ARMED posture: a chain that runs itself.
 *
 *   node server/supervisorChain.test.mjs
 *
 * The counterpart to planToExecution.test.mjs, which covers the ATTENDED posture
 * (supervisor off, a human pressing Run between goals). Between them both postures are
 * pinned, and that matters because today proved they fail differently:
 *
 *   the completion bug lived ONLY in the attended posture - a clean run left its item on
 *   'taken' unless unattended pickup happened to be armed. A test that armed the
 *   supervisor would never have found it. The reverse is equally true, which is why this
 *   file exists rather than one of them being "the" queue test.
 *
 * `loopSmoke` proves a single run survives; `queueChain` proves the enqueue links up.
 * Neither arms the supervisor, so nothing asserted the thing the supervisor is FOR:
 * that one push drains a chain in order, without a person, and then stops.
 *
 * No GPU and no real model - fakemodel.mjs plays scripted agent actions. Fully isolated
 * through scratch()/isolatedEnv()/freePorts(), so a live hub, queue or workspace is never
 * touched.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
import { scratch, startHub, freePorts, waitForQueue, TERMINAL_ITEM } from './testHarness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
// Awaited, deliberately. A sync wrapper around an async check counts as a pass having
// asserted nothing, and its orphaned work surfaces later as an unhandled rejection - that
// exact hole was found in the sibling test hours ago.
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const [hubPort, fakePort] = await freePorts(2);
const dir = scratch('hub-supchain', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
const fake = spawn(process.execPath, [join(__dirname, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'happy'], { stdio: 'ignore' });

let hub = null;
try {
  const started = await startHub(dir, {
    port: hubPort,
    // THE POINT OF THIS FILE. Everything else here is the same as the attended test.
    env: { AGENT_APPROVAL_MODE: 'build', AGENT_SUPERVISOR: '1' },
  });
  hub = started.hub;
  const { api } = started;

  await test('the hub comes up with unattended pickup actually armed', async () => {
    const s = await api('/agent/supervisor');
    assert.equal(s.supervisor, true, 'the env override did not arm it - the rest of this file would prove nothing');
    assert.equal(s.forced, true, 'AGENT_SUPERVISOR=1 should report as forced, not merely on');
  });

  const chain = await api('/agent/queue/chain', {
    method: 'POST',
    body: JSON.stringify({ goals: ['Create alpha.txt containing the word alpha', 'Create beta.txt containing the word beta'] }),
  });

  await test('the chain queues in order, each link waiting on the one before', () => {
    assert.equal(chain.queued.length, 2);
    assert.equal(chain.queued[0].after, null);
    assert.equal(chain.queued[1].after, chain.queued[0].id);
  });

  // ONE push. After this a human does nothing, which is the entire contract.
  await api('/agent/queue/run', { method: 'POST' });

  const settled = await waitForQueue(api, { minutes: 8, every: 2000 });

  await test('ONE push drains the whole chain - no further human action', () => {
    assert.equal(settled.settled, true,
      `the backlog never emptied: ${JSON.stringify(settled.items.map((i) => [i.goal.slice(0, 22), i.status]))}`);
    for (const i of settled.items) {
      assert.ok(TERMINAL_ITEM.includes(i.status), `${i.id} ended '${i.status}', which the loop does not recognise`);
    }
  });

  await test('both goals actually succeeded, not merely settled', () => {
    const done = settled.items.filter((i) => i.status === 'done');
    assert.equal(done.length, 2, `expected 2 done, got ${JSON.stringify(settled.items.map((i) => i.status))}`);
  });

  await test('the second goal ran AFTER the first finished - order, not just completion', () => {
    const first = settled.items.find((i) => i.id === chain.queued[0].id);
    const second = settled.items.find((i) => i.id === chain.queued[1].id);
    assert.ok(first.finishedAt && second.finishedAt, 'both should record a finish time');
    // `after` exists to stop step 2 starting before step 1 is done. If the supervisor ever
    // dequeued on priority alone this is the assertion that catches it.
    assert.ok(second.takenAt >= first.finishedAt,
      `step 2 was taken at ${second.takenAt} but step 1 only finished at ${first.finishedAt}`);
  });

  await test('it STOPS - a self-running chain must not breed more work', () => {
    // The brakes exist because a model that ends each run suggesting a follow-up once
    // produced 40 runs in 60 seconds. Two goals in, two goals out.
    assert.equal(settled.items.length, 2,
      `queue grew to ${settled.items.length}: ${JSON.stringify(settled.items.map((i) => i.goal.slice(0, 30)))}`);
  });

  await test('the auto-starts were counted, and stayed under the hourly ceiling', async () => {
    const s = await api('/agent/supervisor');
    assert.ok(s.autoStartsLastHour >= 1, 'the supervisor started a run without recording it against the cap');
    assert.ok(s.autoStartsLastHour <= s.maxAutoStartsPerHour, 'the ceiling was exceeded');
  });
} finally {
  try { if (hub) hub.kill(); } catch {}
  try { fake.kill(); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log(`supervisor chain: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
