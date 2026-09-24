/**
 * removedTool.test.mjs - A TOOL REMOVED BY ROUTE BOUNDING IS ANSWERED AS UNAVAILABLE, NOT AS A PARSE ERROR.
 *
 *   node server/removedTool.test.mjs
 *
 * BENCH-2, chain step 1: the model asked for verify_project three times - a route that bounding
 * removes - and the hub said "Could not parse an action" each time, then stopped it for three
 * identical responses. The action was well formed; the tool was gone; the feedback was wrong.
 *
 * Through the REAL bounded route with scripted replies:
 *   1. a recognisable verify_project action receives "TOOL UNAVAILABLE in this configuration"
 *      naming run_python and run_command, and is NOT logged as a parse failure
 *   2. verify_project is still not executed (isolation unchanged)
 *   3. a subsequent valid run_python executes
 *   4. continued repetition remains bounded by the existing repeat guard
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

const VERIFY = 'THOUGHT: Before proceeding, I should verify the current state of the project.\n\nACTION: verify_project';
const RUN = 'THOUGHT: Testing with run_python instead.\nACTION: run_python\nCODE:\n```python\nimport m\nprint("value", m.f())\n```';

const [hubPort, fakePort] = await freePorts(2);
const dir = scratch('rt', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
mkdirSync(join(dir, 'workspace'), { recursive: true });
writeFileSync(join(dir, 'workspace', 'm.py'), 'def f():\n    return 41 + 1\n', 'utf8');
const rf = join(dir, 'replies.json');
// one refusal, one valid action, then the same refused action forever
writeFileSync(rf, JSON.stringify([VERIFY, RUN, VERIFY]), 'utf8');
const promptLog = join(dir, 'prompts.jsonl');
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf],
  { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
let hub = null;
try {
  const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
  hub = started.hub;
  const { api } = started;
  const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Check that m.py works.' }) });
  let run = null;
  for (let i = 0; i < 120; i++) {
    run = await api(`/agent/${runId}`).catch(() => null);
    if (run && run.status && run.status !== 'running' && !run.busy) break;
    await sleep(1000);
  }
  const steps = run?.steps || [];
  const reqs = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const sentText = reqs.map((r) => r.messages.map((m) => String(m.content)).join('\n')).join('\n');

  console.log('=== 1. the feedback ===');
  const unavailable = steps.filter((s) => s.type === 'route_unavailable' && s.route === 'verify_project');
  say(unavailable.length >= 1, `route_unavailable step recorded for verify_project (${unavailable.length})`);
  say(/TOOL UNAVAILABLE in this configuration: verify_project/.test(sentText), 'the model was told: TOOL UNAVAILABLE in this configuration: verify_project');
  say(/NOT a parse error/.test(sentText), 'and that it was not a parse error');
  say(/run_python/.test(sentText.split('TOOL UNAVAILABLE')[1] || '') && /run_command/.test(sentText.split('TOOL UNAVAILABLE')[1] || ''), 'with run_python and run_command named as the alternatives');
  say(!steps.some((s) => /Could not parse an action/.test(s.text || '')), 'no "Could not parse an action" step was logged');

  console.log('\n=== 2. still unavailable ===');
  say(!steps.some((s) => s.type === 'tool' && s.tool === 'verify_project'), 'verify_project never executed');
  say(!/TOOL RESULT \(verify_project\)/.test(sentText), 'and no verify_project result ever reached the model');

  console.log('\n=== 3. the next valid action executes ===');
  const firstUnavail = steps.findIndex((s) => s.type === 'route_unavailable');
  const py = steps.findIndex((s, i) => i > firstUnavail && s.type === 'tool' && s.tool === 'run_python');
  say(py > firstUnavail, 'run_python executed after the refusal');
  say(py >= 0 && /value 42/.test(String(steps[py].result || steps[py].text || '')), `and produced its output (${py >= 0 ? String(steps[py].result || steps[py].text || '').replace(/\n/g, ' ').slice(0, 60) : 'no step'})`);

  console.log('\n=== 4. repetition stays bounded ===');
  say(run?.status === 'stopped' || run?.status === 'error', `the run ended (${run?.status})`);
  say(steps.some((s) => /same response 3 times/.test(s.text || '')), 'stopped by the existing repeat guard');
  const after = steps.slice(py + 1).filter((s) => s.type === 'route_unavailable').length;
  say(after >= 1 && after <= 4, `${after} further verify_project attempts before the guard stopped it (bounded)`);
} finally {
  try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
  try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  removed tool: ${passed} passed, ${failed} failed -> ${failed ? 'A REMOVED TOOL IS STILL MISREPORTED' : 'removed tools are reported as unavailable, alternatives named, isolation and the guard unchanged'}`);
process.exit(failed ? 1 : 0);
