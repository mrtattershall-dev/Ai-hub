/**
 * planToExecution.test.mjs - a plan becomes executed work, in one run.
 *
 *   node server/planToExecution.test.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * Every piece of the pipeline is tested and the PIPELINE is not. flow.test.mjs proves a
 * plan derives goals; queueChain proves goals enqueue in order; loopSmoke proves the agent
 * loop survives a run. Nothing has ever asserted that markdown written by a planner comes
 * out the far end as executed, settled work — which is the only claim the product actually
 * makes.
 *
 * The seam this covers is where the breaks have been: the derivation is client-side, the
 * queue is server-side, and the two agree only by convention. A goal shape change on
 * either side passes both suites and breaks the product.
 *
 * It is also the consumer `wiring.test.mjs` was asking for. testHarness.mjs exported
 * startHub, waitForQueue and TERMINAL_RUN with nothing importing them, and the right
 * answer to an unwired capability is a caller, not an exemption.
 *
 * No GPU and no real model: fakemodel.mjs plays scripted agent actions, so this is
 * deterministic and takes seconds. Fully isolated via the harness - every override set,
 * nothing touches the live workspace, queue, runs or hub.json.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratch, startHub, freePorts, TERMINAL_RUN } from './testHarness.mjs';
import { planToChain, planToCodeBrief } from '../client/src/lib/flow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
// The wrapper AWAITS. It did not, while one check was async, so that check ran after the
// finally block had killed the hub: it counted as a pass having asserted nothing, and its
// orphaned fetch surfaced as an unhandled ECONNRESET. That is the exact failure
// testHarness.mjs was written about - a green line that never asked the question.
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}` + "\n      " + e.message); process.exitCode = 1; }
};

// A plan in the shape the Action Plan canvas asks for. Two tasks, not five: this is
// testing the path, and every extra goal is another fake run to sit through.
const PLAN = [
  '## Goal',
  'Ship a counter page.',
  '',
  '## Tasks',
  '- Create index.html with a visible counter',
  '  - it must render something, not just parse',
  '- Add a reset button',
  '',
  '## Risks & Mitigations',
  '- Do not fetch anything remote.',
].join('\n');

/**
 * Poll until ONE item settles. waitForQueue asks whether the whole backlog is empty,
 * which a disarmed queue deliberately never is - it holds the next goal until a human
 * releases it. Asking the wrong question there is what made this test report stranding
 * where the product was behaving as designed.
 */
async function waitForItem(api, id, { seconds = 180 } = {}) {
  const deadline = Date.now() + seconds * 1000;
  let item = null;
  while (Date.now() < deadline) {
    const q = await api('/agent/queue');
    item = (q.items || []).find((i) => i.id === id);
    if (!item) return { status: 'gone' };
    if (['done', 'failed', 'cancelled', 'stopped'].includes(item.status)) return item;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return item || { status: 'never appeared' };
}

const planOutput = { kind: 'strategy', response: PLAN, streaming: false, canvasId: 'plan' };

// ---- 1. the derivation, before any server is involved --------------------------------
const chain = planToChain(planOutput);

await test('the plan yields one goal per top-level task, sub-detail folded in', () => {
  assert.equal(chain.goals.length, 2);
  assert.match(chain.goals[0], /Create index\.html/);
  assert.match(chain.goals[0], /render something/);      // the nested line travelled with it
  assert.match(chain.goals[0], /Part of: Ship a counter page\./);
});

await test('the same plan also yields a build brief, carrying the risks as constraints', () => {
  const brief = planToCodeBrief(planOutput);
  assert.match(brief.input, /Constraints to respect/);
  assert.match(brief.input, /Do not fetch anything remote/);
});

// ---- 2. the far end: those exact goals, executed by a real hub ------------------------
const [hubPort, fakePort] = await freePorts(2);
const dir = scratch('hub-plan2exec', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });

const fake = spawn(process.execPath, [join(__dirname, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'happy'], { stdio: 'ignore' });
let hub = null;

try {
  const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build' } });
  hub = started.hub;
  const { api } = started;

  // Exactly what OutputBlock's "Queue as an unattended chain" posts.
  const posted = await api('/agent/queue/chain', { method: 'POST', body: JSON.stringify({ goals: chain.goals }) });

  await test('the client-derived goals are accepted by the server verbatim', () => {
    assert.equal((posted.queued || []).length, 2, JSON.stringify(posted).slice(0, 300));
    assert.deepEqual(posted.skipped, []);
  });

  await test('the chain keeps the plan order as a real dependency', () => {
    const [first, second] = posted.queued;
    assert.equal(first.after, null);
    assert.equal(second.after, first.id, 'step 2 must wait on step 1, or an agent runs them out of order');
  });

  // ---- the human-paced posture, which is the one tatte is told to use ----------------
  //
  // Supervisor OFF means the queue does not advance itself: a person presses Run for each
  // goal. That is BY DESIGN and must not be confused with stranding, which is what the
  // first version of this test did. The real bug it found was different and worse - a run
  // that finished cleanly never marked its item 'done' unless the supervisor was armed, so
  // the item sat on 'taken' forever and everything behind it waited on an id that could
  // never be satisfied. Fixed by ai-native-engine-00; these two checks are what prove it.
  // Release the first goal the way a person does. This line was lost in a rewrite, and
  // its absence looked exactly like a product bug: the test waited three minutes for an
  // item it had never started, reported it stranded, and the release below then ran goal
  // ONE rather than goal two. A missing action is indistinguishable from a broken system
  // unless the assertion checks what the action returned - so this one does.
  const released = await api("/agent/queue/run", { method: "POST" });

  await test("releasing the first goal starts a run on that goal", () => {
    // The route answers { runId, item } on success, 404 { error } when the queue is empty,
    // 409 { busy } when a run holds the workspace. An earlier version of this check
    // accepted anything truthy, so a refusal passed and surfaced three assertions later.
    assert.ok(released && released.runId, "queue/run refused: " + JSON.stringify(released).slice(0, 200));
    assert.equal(released.item && released.item.id, posted.queued[0].id, "started the wrong item");
  });

  const firstSettled = await waitForItem(api, posted.queued[0].id, { seconds: 180 });

  // A test that fails must say what it saw. The first version reported only the item's
  // status, which is the one fact that cannot explain itself.
  if (firstSettled.status !== 'done') {
    const list = await api('/agent/list');
    const runs = Array.isArray(list) ? list : (list.runs || []);
    console.error('  DIAGNOSTIC: runs =', JSON.stringify(runs.map((r) => ({ id: r.id, status: r.status, queueItemId: r.queueItemId, steps: (r.steps || []).length }))));
    for (const r of runs) {
      const d = await api(`/agent/${r.id}`);
      console.error(`  DIAGNOSTIC: run ${r.id} status=${d.status}`,
        'steps:', (d.steps || []).slice(-6).map((s) => `${s.type}${s.tool ? ':' + s.tool : ''}`).join(' -> '),
        d.pending ? `PENDING ${JSON.stringify(d.pending).slice(0, 120)}` : '');
    }
    console.error('  DIAGNOSTIC: hub log tail:', started.log.join('').slice(-700));
  }

  await test('a clean run marks its own queue item done, with no supervisor involved', () => {
    assert.equal(firstSettled.status, 'done',
      `item 1 is '${firstSettled.status}' - finishing is not supervision, and a run that ` +
      `completed must complete its ticket whatever the posture`);
  });

  await test('the next goal waits for a human rather than advancing itself', async () => {
    const q = await api('/agent/queue');
    const second = q.items.find((i) => i.id === posted.queued[1].id);
    assert.equal(second.status, 'queued', 'a disarmed queue must not start work on its own');
    assert.equal(second.after, posted.queued[0].id, 'and it must still remember what it waits on');
  });

  // Press Run again, the way a person would.
  await api('/agent/queue/run', { method: 'POST' });
  const secondSettled = await waitForItem(api, posted.queued[1].id, { seconds: 180 });

  await test('releasing the second goal by hand runs it, in the order the plan asked for', () => {
    assert.equal(secondSettled.status, 'done', `item 2 is '${secondSettled.status}'`);
  });

  await test('the runs behind those goals finished in a state the loop recognises', async () => {
    const list = await api('/agent/list');
    const runs = Array.isArray(list) ? list : (list.runs || []);
    assert.ok(runs.length >= 2, `expected a run per goal, got ${runs.length}`);
    for (const r of runs) assert.ok(TERMINAL_RUN.includes(r.status), `run ${r.id} left in ${r.status}`);
  });

  await test('the hub survived the whole path', () => {
    assert.equal(started.died(), null, `hub exited: ${started.died()}`);
  });

} finally {
  try { fake.kill(); } catch {}
  try { hub && hub.kill(); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log(`plan to execution: ${passed} passed`);
