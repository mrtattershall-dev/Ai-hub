/**
 * callDeadline.test.mjs - A MODEL CALL THAT NEVER RETURNS IS RECORDED AS THAT, NOT AS A FAILED TASK.
 *
 *   node server/callDeadline.test.mjs
 *
 * BENCH-2: four of fifteen runs ended on a model request that never came back. The serving
 * container streamed heartbeats, so the stall timer never fired; the run was stopped by the
 * runner with the request open; and the record afterwards said only "empty reply". Those four
 * were then counted, wrongly, as budget exhaustion by the model.
 *
 * Through the REAL hub route, against stub backends that misbehave on purpose:
 *
 *   1. NEVER replies (heartbeats forever): the call is aborted at a deadline BELOW the task
 *      budget; the ledger records id, dispatch, completion, outcome DEADLINE_LOCAL_ABORT and
 *      serverOutcome UNKNOWN; the step text says the server outcome is unknown and never
 *      claims a server-side cancellation; the transcript has no reply field for it; the
 *      server saw the client leave.
 *   2. Budget remains after a deadline: a fresh call is dispatched (the run is not killed
 *      by one lost call).
 *   3. Replies LATE: the run is stopped while the call is open; the late answer never
 *      executes a tool; the ledger says ABORTED_BY_STOP; the server never sent it.
 *   4. A GENUINELY empty reply is COMPLETED_EMPTY with reply: '' and empty: true - a real
 *      reply, distinguishable from every timeout record.
 *   5. The ordinary path: COMPLETED, no deadline when no budget is declared, no deadline text.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dirs = [];
// The fake's planner detection keys on the game planner's wording, so the PLAN reply is scripted
// explicitly, as suppliedFile.test does. A file is seeded so the finish gate has a project to run.
const PLAN = '1. WHAT IT DOES - prints a value.\n2. FILES - m.py\n3. BUILD ORDER - test it\n4. HOW TO VERIFY - run it';
const ACTION = 'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nimport m\nprint("ran", m.f())\n```';

async function drive({ replies, fakeArgs = [], start, until, label, afterStart }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`cd-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  mkdirSync(join(dir, 'workspace'), { recursive: true });
  writeFileSync(join(dir, 'workspace', 'm.py'), 'def f():\n    return 42\n', 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const eventLog = join(dir, 'events.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf, ...fakeArgs],
    { stdio: 'ignore', env: { ...process.env, FAKE_EVENT_LOG: eventLog } });
  let hub = null;
  const t0 = Date.now();
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
    hub = started.hub;
    const { api } = started;
    const { runId, error } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Print something.', ...start }) });
    if (!runId) throw new Error('hub did not start a run: ' + error);
    if (afterStart) await afterStart(api, runId);
    let run = null;
    const deadline = Date.now() + (until || 90_000);
    while (Date.now() < deadline) {
      run = await api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(500);
    }
    const tpath = join(dir, 'runs', `${runId}.transcript.jsonl`);
    const transcript = existsSync(tpath) ? readFileSync(tpath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const events = existsSync(eventLog) ? readFileSync(eventLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const onDisk = existsSync(join(dir, 'runs', `${runId}.json`)) ? JSON.parse(readFileSync(join(dir, 'runs', `${runId}.json`), 'utf8')) : null;
    return { run, transcript, events, onDisk, elapsedMs: Date.now() - t0, runId, ws: join(dir, 'workspace') };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
const turnCalls = (r) => (r.run?.calls || []).filter((c) => c.callKind === 'turn');
const stepText = (r) => (r.run?.steps || []).map((s) => s.text || '').join('\n');
const toolSteps = (r) => (r.run?.steps || []).filter((s) => s.type === 'tool');

try {
  // ── 1. NEVER REPLIES ──
  console.log('=== 1. a backend that never answers: aborted at a deadline below the budget, recorded as unknown ===');
  const a = await drive({ replies: [PLAN, ACTION], fakeArgs: ['--never'], start: { budgetSec: 20 }, until: 60_000, label: 'never' });
  const ac = turnCalls(a)[0];
  say(a.run && a.run.status !== 'running', `the run ended (${a.run?.status}) in ${Math.round(a.elapsedMs / 1000)}s, not at the 300s the runner would have needed`);
  say(a.elapsedMs < 40_000, 'well inside the 20s task budget plus startup');
  say(!!ac && !!ac.callId && ac.dispatchedAt > 0 && ac.completedAt > ac.dispatchedAt, `the ledger has the call: id, dispatch, completion (${ac ? ac.elapsedMs + 'ms' : 'MISSING'})`);
  say(ac?.deadlineMs > 0 && ac.deadlineMs < 20_000, `its deadline (${ac?.deadlineMs}ms) is BELOW the 20s budget`);
  say(ac?.outcome === 'DEADLINE_LOCAL_ABORT', `outcome DEADLINE_LOCAL_ABORT (${ac?.outcome})`);
  say(ac?.serverOutcome === 'UNKNOWN', 'serverOutcome UNKNOWN');
  say(/server outcome unknown/i.test(stepText(a)), 'the step text says the server outcome is unknown');
  // "not a confirmed cancellation" is the wanted disclaimer; strip it, then any remaining
  // "confirmed cancel" wording would be a false claim of server-side cancellation.
  say(!/confirmed cancel|cancelled on the server/i.test(stepText(a).replace(/not a confirmed cancellation/gi, '')) && /not a confirmed cancellation/i.test(stepText(a)),
    'and never claims a confirmed server-side cancellation');
  say(/never returned, not a task the model failed/.test(stepText(a)), 'the terminal step distinguishes an unreturned call from a failed task');
  const aRec = a.transcript.find((t) => t.kind === 'turn' && t.outcome);
  say(!!aRec && !('reply' in aRec) && aRec.outcome === 'DEADLINE_LOCAL_ABORT', 'the transcript record is an error record with an outcome and NO reply field');
  say(a.events.some((e) => e.event === 'client-aborted'), 'the server saw the client abort (the request was open; the hub closed it)');
  say(Array.isArray(a.onDisk?.calls) && a.onDisk.calls.some((c) => c.outcome === 'DEADLINE_LOCAL_ABORT'), 'the ledger is on disk with the run');

  // ── 2. BUDGET REMAINS: a fresh call follows ──
  console.log('\n=== 2. with budget remaining, a lost call is followed by a fresh one ===');
  const b = await drive({
    replies: [PLAN, ACTION], fakeArgs: ['--never'], start: { budgetSec: 120, callDeadlineSec: 3 }, until: 40_000, label: 'retry',
    afterStart: async (api, id) => {
      // wait for two turn calls to have been dispatched, then stop
      for (let i = 0; i < 60; i++) {
        const r = await api(`/agent/${id}`).catch(() => null);
        if ((r?.calls || []).filter((c) => c.callKind === 'turn').length >= 2) break;
        await sleep(500);
      }
      await api(`/agent/${id}/stop`, { method: 'POST' });
    },
  });
  const bc = turnCalls(b);
  say(bc.length >= 2, `a second turn call was dispatched after the first deadline (${bc.length} turn calls)`);
  say(bc[0]?.outcome === 'DEADLINE_LOCAL_ABORT' && bc[0].deadlineMs === 3000, `the first ended DEADLINE_LOCAL_ABORT at the declared 3s (${bc[0]?.outcome} ${bc[0]?.deadlineMs}ms)`);
  say(b.run?.status === 'stopped', `and the stop landed (${b.run?.status})`);

  // ── 3. LATE REPLY, RUN STOPPED FIRST ──
  console.log('\n=== 3. a late reply after the run is stopped never executes a tool ===');
  const c = await drive({
    replies: [PLAN, ACTION], fakeArgs: ['--delay-ms', '6000'], start: { budgetSec: 120 }, until: 30_000, label: 'late',
    afterStart: async (api, id) => {
      for (let i = 0; i < 120; i++) {
        const r = await api(`/agent/${id}`).catch(() => null);
        if ((r?.calls || []).some((x) => x.callKind === 'turn' && x.outcome === 'IN_FLIGHT')) break;
        await sleep(250);
      }
      await sleep(1500);   // let the server receive the request, so the stop lands on a call it is holding
      await api(`/agent/${id}/stop`, { method: 'POST' });
      await sleep(8_000);   // long enough for the late answer to have arrived, had anyone been listening
    },
  });
  const cc = turnCalls(c)[0];
  note(`calls: ${JSON.stringify((c.run?.calls || []).map((x) => [x.callKind, x.outcome, x.elapsedMs, x.error]))}  steps: ${(c.run?.steps || []).map((s) => s.type).join(',')}`);
  say(c.run?.status === 'stopped', `the run is stopped (${c.run?.status})`);
  say(toolSteps(c).length === 0, `no tool executed after the stop (${toolSteps(c).length} tool steps)`);
  say(cc?.outcome === 'ABORTED_BY_STOP' && cc.serverOutcome === 'UNKNOWN', `the ledger says ABORTED_BY_STOP / UNKNOWN (${cc?.outcome} / ${cc?.serverOutcome})`);
  // the plan call (request #1) is also delayed by the stub and legitimately answered; the turn call (#2) must not be
  const lateSent = c.events.filter((e) => e.event === 'late-reply-sent' && e.seq > 1);
  say(c.events.some((e) => e.event === 'late-reply-not-sent-client-gone' && e.seq > 1) && lateSent.length === 0,
    `the server found the client gone and never sent the turn's late reply (${c.events.map((e) => e.event + '#' + e.seq).join(' ')})`);

  // ── 3b. GENUINELY LATE ARRIVAL: the bytes are in hand when the stop lands ──
  console.log('\n=== 3b. a complete reply that ARRIVES after the stop is recorded and never acted on ===');
  const WRITE = 'THOUGHT: Writing.\nACTION: write_file\nPATH: late.txt\n```text\nthis must never land\n```';
  const h = await drive({
    replies: [PLAN, WRITE], fakeArgs: ['--hold-ms', '6000'], start: { budgetSec: 120 }, until: 30_000, label: 'hold',
    afterStart: async (api, id) => {
      // wait until a turn call is in flight AND the stub has sent the bytes, then stop
      for (let i = 0; i < 120; i++) {
        const r = await api(`/agent/${id}`).catch(() => null);
        if ((r?.calls || []).some((x) => x.callKind === 'turn' && x.outcome === 'IN_FLIGHT')) break;
        await sleep(250);
      }
      await sleep(1500);
      await api(`/agent/${id}/stop`, { method: 'POST' });
      await sleep(8_000);
    },
  });
  const hc = turnCalls(h)[0];
  say(h.events.some((e) => e.event === 'held-reply-bytes-sent' && e.seq > 1), 'the stub had sent the complete reply before the stop');
  say(h.run?.status === 'stopped', `the run is stopped (${h.run?.status})`);
  say(hc?.outcome === 'COMPLETED_NOT_ACTED_ON' && hc.chars > 0, `the ledger says COMPLETED_NOT_ACTED_ON with ${hc?.chars} chars (${hc?.outcome})`);
  say(toolSteps(h).length === 0, `no tool executed (${toolSteps(h).length} tool steps)`);
  say(!existsSync(join(h.ws, 'late.txt')), 'the workspace was not mutated');
  const hRec = h.transcript.find((t) => t.kind === 'turn' && t.discarded === true);
  note(`transcript: ${h.transcript.map((t) => `${t.kind}${t.callKind ? ':' + t.callKind + ':' + t.outcome : ''}${t.discarded ? ':discarded' : ''}${t.error ? ':err=' + t.error : ''}`).join(' | ')}`);
  // (the stub re-serves the PLAN on the first turn, so the discarded reply's TEXT is the plan; what
  // matters is that the bytes the ledger counted are the bytes the transcript kept)
  say(!!hRec && typeof hRec.reply === 'string' && hRec.reply.length === hc?.chars && hRec.reply.length > 0, `the transcript keeps the reply (${hRec?.reply?.length} chars), marked discarded`);

  // ── 4. GENUINELY EMPTY REPLY ──
  console.log('\n=== 4. a genuinely empty reply is a reply, not a timeout ===');
  const d = await drive({ replies: [PLAN, ''], start: { budgetSec: 60 }, until: 60_000, label: 'empty' });
  // the fake re-serves the PLAN on the first turn (its fresh-run reset), so the empty reply is turn 2
  const dc = turnCalls(d).find((x) => x.outcome === 'COMPLETED_EMPTY');
  say(!!dc, `a turn call ended COMPLETED_EMPTY (${turnCalls(d).map((x) => x.outcome).join(',')})`);
  const dRec = d.transcript.find((t) => t.kind === 'turn' && t.empty === true);
  say(!!dRec && dRec.reply === '' && dRec.empty === true && !dRec.error, "the transcript has reply: '' with empty: true and no error");
  say(d.run && d.run.status !== 'running', `and the run still ended bounded (${d.run?.status})`);
  say(!/deadline/i.test(stepText(d)), 'with no deadline text - nothing timed out');

  // ── 5. ORDINARY PATH ──
  console.log('\n=== 5. the ordinary path is unchanged ===');
  const e = await drive({ replies: [PLAN, ACTION, 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok'],
    // the goal names the .py entry so the finish gate verifies it as Python (the workspace
    // marker package.json would otherwise make it "node" and refuse the finish)
    start: { goal: 'Check that m.py returns 42 and report.' }, until: 60_000, label: 'plain' });
  const ec = turnCalls(e);
  say(e.run?.status === 'done', `the run finished (${e.run?.status})`);
  note(`steps: ${(e.run?.steps || []).map((s) => `${s.type}${s.tool ? ':' + s.tool : ''}${s.text ? ' ' + String(s.text).slice(0, 70).replace(/\n/g, ' ') : ''}`).join(' | ')}`);
  say(toolSteps(e).some((s) => s.tool === 'run_python'), 'the tool ran');
  say(ec.length >= 2 && ec.every((x) => x.outcome === 'COMPLETED'), `every turn call COMPLETED (${ec.map((x) => x.outcome).join(',')})`);
  say(ec.every((x) => x.deadlineMs === null), 'no deadline when no budget was declared (pre-existing timers apply)');
  say(!/deadline|server outcome/i.test(stepText(e)), 'no deadline text');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  call deadline: ${passed} passed, ${failed} failed -> ${failed ? 'AN UNRETURNED CALL IS STILL INDISTINGUISHABLE FROM A FAILED TASK' : 'unreturned calls are recorded as unreturned, late replies never act, empty replies are replies'}`);
process.exit(failed ? 1 : 0);
