/**
 * finishGateHost.test.mjs - UNDER BOUNDING, THE FINISH PATH CANNOT INVOKE THE HOST VERIFIER.
 *
 *   node server/finishGateHost.test.mjs
 *
 * The finish gate called verifier.verify(WORKSPACE), which runs `python <entry>` on the HOST,
 * without a tool call - so route bounding, which removed the verify_project TOOL, left this
 * path open in every campaign that reached a finish (EXECUTION-DEFECTS_RESULT.md §3).
 *
 * The instrument: m.py writes a marker naming the OS it ran on when executed as __main__. The
 * worker is Linux; this host is Windows. So "no HOST_RAN marker, or one that is not Windows"
 * means the host never ran it, and the UNBOUNDED positive control must produce a Windows
 * marker - proving the gate is reached and would have executed, so "nothing executed" cannot
 * pass merely because the finish path was never taken.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dirs = [];
const HOST = platform() === 'win32' ? 'Windows' : platform() === 'darwin' ? 'Darwin' : 'Linux';

const M = 'import platform\n\ndef f():\n    return 42\n\nif __name__ == "__main__":\n    open("HOST_RAN", "w").write(platform.system())\n';
const PLAN = '1. WHAT IT DOES - m.py\n2. FILES - m.py\n3. BUILD ORDER - test\n4. HOW TO VERIFY - run';
const TEST = 'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nimport m\nprint(m.f())\n```';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';

async function drive(env, label) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`fg-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'm.py'), M, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify([PLAN, TEST, FINISH]), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', ...env } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Check that m.py returns 42 and report.' }) });
    let run = null;
    for (let i = 0; i < 120; i++) {
      run = await started.api(`/agent/${runId}`).catch(() => null);
      if (run && run.status !== 'running' && !run.busy) break;
      await sleep(500);
    }
    const marker = existsSync(join(ws, 'HOST_RAN')) ? readFileSync(join(ws, 'HOST_RAN'), 'utf8') : null;
    return { run, marker };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
const steps = (r) => r.run?.steps || [];

try {
  console.log(`=== positive control: the UNBOUNDED hub reaches the gate and runs the entry on the host (${HOST}) ===`);
  const u = await drive({ AGENT_BOUND_ROUTES: '', AGENT_WORKER_EXEC: '' }, 'unbounded');
  say(u.run?.status === 'done', `the run finished (${u.run?.status})`);
  say(steps(u).some((s) => /Verified \(python\)/.test(s.text || '')), 'the gate verified the project');
  say(u.marker === HOST, `the entry ran ON THE HOST: marker "${u.marker}"`);

  console.log('\n=== under bounding: the same finish path cannot invoke the host verifier ===');
  const b = await drive({ AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' }, 'bounded');
  say(b.run?.status === 'done', `the run finished (${b.run?.status}) - the finish path WAS reached`);
  say(steps(b).some((s) => s.type === 'finish'), 'a finish step exists');
  say(steps(b).some((s) => s.type === 'route_closed' && /Finish-time host verification is closed/.test(s.text || '')), 'the gate was reached and recorded as CLOSED');
  say(b.run?.finishVerification === 'CLOSED_UNDER_BOUNDING', `finishVerification = ${b.run?.finishVerification}`);
  say(!steps(b).some((s) => /Verified \(python\)|Project does not run/.test(s.text || '')), 'no host verification verdict of either kind');
  say(b.marker !== HOST, `the entry did not run on the host (marker: ${b.marker === null ? 'none' : JSON.stringify(b.marker)})`);
  say(steps(b).some((s) => s.type === 'tool' && s.tool === 'run_python' && /42/.test(String(s.result || ''))), "the model's own test still executed (in the worker) and returned 42");
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
console.log(`\n  finish-gate host escape: ${passed} passed, ${failed} failed -> ${failed ? 'THE FINISH PATH CAN STILL REACH THE HOST' : 'bounded: gate reached, closed, nothing on the host; unbounded control executed'}`);
process.exit(failed ? 1 : 0);
