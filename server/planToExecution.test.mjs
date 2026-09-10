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
import { scratch, startHub, waitForQueue, freePorts, TERMINAL_RUN, TERMINAL_ITEM } from './testHarness.mjs';
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

  // Release the chain. One explicit start; the supervisor pulls the rest as each finishes.
  const run = await api('/agent/queue/run', { method: 'POST' });
  await test('releasing the chain starts a run rather than reporting nothing to do', () => {
    assert.ok(run && (run.id || run.runId || run.started), JSON.stringify(run).slice(0, 200));
  });

  const settled = await waitForQueue(api, { minutes: 4, every: 1500 });

  await test('every queued goal reaches a settled state - nothing is stranded', () => {
    assert.ok(settled.settled, `queue never settled: ${JSON.stringify(settled.items.map((i) => [i.goal.slice(0, 30), i.status]))}`);
    for (const item of settled.items) {
      assert.ok(TERMINAL_ITEM.includes(item.status), `${item.goal.slice(0, 40)} left in ${item.status}`);
    }
  });

  await test('the runs those goals produced also finished, in a state the loop recognises', async () => {
    const list = await api('/agent/list');
    const runs = Array.isArray(list) ? list : (list.runs || []);
    assert.ok(runs.length >= 1, 'no runs recorded for a chain that settled');
    for (const r of runs) {
      assert.ok(TERMINAL_RUN.includes(r.status), `run ${r.id} left in ${r.status}`);
    }
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
