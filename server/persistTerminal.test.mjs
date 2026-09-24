/**
 * persistTerminal.test.mjs - COMPLETED WORK IS NEVER ON DISK AS A RUNNING RUN.
 *
 *   node server/persistTerminal.test.mjs
 *
 * CHECK-1: find_in_sorted finished, was evaluated and dispositioned - and its run file said
 * status:"running", because the runner killed the hub after the terminal state was observable
 * over the API but before persist(). A contradictory durable record: recovery would offer
 * completed work as an active/resumable run.
 *
 *   1. THE RACE ITSELF: the moment the API first reports the run settled+finalized, SIGKILL
 *      the hub. The on-disk record must already be terminal, with finalizedAt.
 *   2. finalizedAt is an acknowledgment, not decoration: it appears only with terminal status.
 *   3. INTERRUPTION BEFORE THE BOUNDARY: kill the hub mid-run. The on-disk record says
 *      running (genuinely unfinalized) - and a restarted hub reconciles it EXPLICITLY to
 *      'interrupted' with a note saying why. It is never presented as still running.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dirs = [];
const PLAN = '1. WHAT IT DOES - m.py\n2. FILES - m.py\n3. BUILD ORDER - test\n4. HOW TO VERIFY - run';
const SLOW = 'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nimport time\ntime.sleep(20)\nprint("slow")\n```';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';

async function boot(replies, label, env = {}) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`pt-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  mkdirSync(join(dir, 'workspace'), { recursive: true });
  writeFileSync(join(dir, 'workspace', 'm.py'), 'def f():\n    return 42\n', 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1', ...env } });
  return { dir, fake, ...started };
}
const diskRun = (dir, id) => JSON.parse(readFileSync(join(dir, 'runs', `${id}.json`), 'utf8'));

try {
  console.log('=== 1. the race: kill at the FIRST observation of settled+finalized ===');
  {
    const { dir, fake, hub, api } = await boot([PLAN, 'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nprint("ok")\n```', FINISH], 'race');
    try {
      const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Check m.py and report.' }) });
      let seen = null;
      for (let i = 0; i < 240; i++) {
        seen = await api(`/agent/${runId}`).catch(() => null);
        if (seen && seen.status !== 'running' && !seen.busy && seen.finalizedAt) break;
        await sleep(250);
      }
      hub.kill('SIGKILL');                          // the runner's shutdown, at the worst moment
      say(seen?.status === 'done' && !!seen.finalizedAt, `the API reported settled + finalized (${seen?.status}, ack ${!!seen?.finalizedAt})`);
      const disk = diskRun(dir, runId);
      say(disk.status === 'done', `the on-disk record is TERMINAL at that instant (${disk.status})`);
      say(!!disk.finalizedAt && disk.finalizedAt <= seen.finalizedAt, 'with the same finalization stamp - persisted BEFORE it was observable');
      say(disk.status !== 'running', 'completed work is not on disk as a running run');
    } finally { try { hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
  }

  console.log('\n=== 2. the ack appears only with a terminal status ===');
  {
    const { dir, fake, hub, api } = await boot([PLAN, SLOW, FINISH], 'midrun');
    let runId = null;
    try {
      ({ runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Check m.py and report.' }) }));
      // wait until the slow tool is executing (the run is mid-flight and persisted as running)
      for (let i = 0; i < 120; i++) {
        const r = await api(`/agent/${runId}`).catch(() => null);
        if (r && (r.steps || []).some((s) => s.type === 'policy_allowed')) break;
        await sleep(250);
      }
      await sleep(1500);
      const mid = await api(`/agent/${runId}`);
      say(mid.status === 'running' && !mid.finalizedAt, `mid-run: running, NO finalization ack (${mid.status}, ack ${!!mid.finalizedAt})`);
      hub.kill('SIGKILL');                          // interruption BEFORE the boundary
      await sleep(500);
      const disk = diskRun(dir, runId);
      say(disk.status === 'running' && !disk.finalizedAt, `on disk: genuinely unfinalized (${disk.status}) - the truthful record of an interrupted process`);

      console.log('\n=== 3. recovery reconciles the unfinalized record EXPLICITLY ===');
      try { fake.kill('SIGKILL'); } catch {}
      const again = await startHub(dir, { port: (await freePorts(1))[0], env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
      try {
        const rec = await again.api(`/agent/${runId}`);
        say(rec.status === 'interrupted', `recovered as INTERRUPTED, never as running (${rec.status})`);
        say(/unfinalized|no terminal persist/.test(rec.reconciled || ''), `with the explicit reconciliation reason (${String(rec.reconciled).slice(0, 60)}...)`);
        say((rec.steps || []).some((s) => /recovered as interrupted/.test(s.text || '')), 'and a visible step saying so');
      } finally { try { again.hub.kill('SIGKILL'); } catch {} }
    } finally { try { hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
console.log(`\n  terminal persistence: ${passed} passed, ${failed} failed -> ${failed ? 'COMPLETED WORK CAN STILL BE ON DISK AS RUNNING' : 'terminal state is durable before release; unfinalized records reconcile explicitly'}`);
process.exit(failed ? 1 : 0);
