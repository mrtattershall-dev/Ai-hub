/**
 * repeatWarning.test.mjs - THE REPEAT WARNING REACHES THE MODEL BEFORE THE RUN IS STOPPED.
 *
 *   node server/repeatWarning.test.mjs
 *
 * THE DEFECT (BENCH-1_BOUNDARY.md). On the 2nd identical read the Hub substitutes the whole
 * file for the tool result - and the repeat warning was attached to the result it replaced.
 * The warning first went out on call 4; the guard stops after 3 identical replies. So the model
 * was routinely stopped for repeating without ever being told it was repeating.
 *
 * Proven through the REAL agent route with scripted replies and a recording backend. No GPU.
 * The preserved failing trace (legasus/fixtures/bench1/pascal-replies.json) is the regression
 * fixture: it is the exact sequence that exposed the bug.
 *
 *   1. the warning reaches the model BEFORE repetition termination
 *   2. a subsequent different, valid action executes normally
 *   3. continued identical actions still terminate within the existing bound
 *   4. the ordinary successful path is unchanged
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { externalTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIX = join(HERE, '..', 'legasus', 'fixtures', 'bench1');
const task = externalTasks().find((t) => t.id === 'ext-pascal');
const dirs = [];

/** Drive the real hub with a recorded reply sequence; return the run and every request sent. */
async function drive(repliesFile, label) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`rw-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  for (const [f, body] of Object.entries(task.seed)) writeFileSync(join(ws, f), body, 'utf8');
  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', repliesFile],
    { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1' } });
    hub = started.hub;
    const { api } = started;
    const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: `${task.goal}\n\n${BENCH_GUIDANCE}` }) });
    let run = null;
    for (let i = 0; i < 90; i++) {
      run = await api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(1000);
    }
    const reqs = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return { run, reqs, ws };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
const newestUser = (r) => [...(r?.messages || [])].reverse().find((m) => m.role === 'user' && /^TOOL RESULT|^THE HUB IS SHOWING YOU/.test(String(m.content)))?.content || '';
const hasWarning = (s) => /⚠️ You already ran this exact/.test(s);
const toolCalls = (run) => (run?.steps || []).filter((s) => s.tool);
const stoppedByGuard = (run) => (run?.steps || []).some((s) => s.type === 'error' && /same response|identical answer/.test(String(s.text || '')));

const OUTLINE = 'THOUGHT: Before making any changes, I need to understand the current implementation.\nACTION: outline_file\nPATH: pascal.py';
const PLAN = JSON.parse(readFileSync(join(FIX, 'pascal-replies.json'), 'utf8'))[0];

try {
  // ── 1 + 3. THE PRESERVED FAILING TRACE ──
  console.log('=== 1. the regression fixture: the exact BENCH-1 pascal sequence ===');
  const a = await drive(join(FIX, 'pascal-replies.json'), 'fixture');
  const calls = toolCalls(a.run);
  say(calls.length >= 3 && calls.every((s) => s.tool === 'outline_file'), `the fixture still loops on outline_file (${calls.length} calls)`);
  say(stoppedByGuard(a.run), 'and is still stopped by the repeat guard - the limit is UNCHANGED');
  // the guard marks call 2; the warning must be in the request that follows call 2
  const firstWarnedCall = calls.findIndex((s) => hasWarning(String(s.result || ''))) + 1;
  const reqWithWarning = a.reqs.findIndex((r) => hasWarning(newestUser(r)));
  const reqWithResult = a.reqs.findIndex((r) => /1 declarations|THE HUB IS SHOWING YOU/.test(newestUser(r)));
  const warnedAfterCall = reqWithWarning - reqWithResult + 1;
  say(firstWarnedCall === 2, `the guard marks the repeat on call #${firstWarnedCall}`);
  say(warnedAfterCall === 2, `the WARNING now reaches the model after call #${warnedAfterCall} - the same call the guard marked (was 4)`);
  const substitutedReq = a.reqs.find((r) => /THE HUB IS SHOWING YOU/.test(newestUser(r)));
  say(!!substitutedReq && hasWarning(newestUser(substitutedReq)), 'the substituted whole-file message CARRIES the warning - both survive');
  say(!!substitutedReq && /def pascal/.test(newestUser(substitutedReq)), 'and it still carries the file content the substitution exists to provide');
  const stopIdx = (a.run?.steps || []).findIndex((s) => s.type === 'error' && /same response|identical/.test(String(s.text || '')));
  say(reqWithWarning >= 0 && reqWithWarning < a.reqs.length - 1, `the warning was sent BEFORE termination (request #${reqWithWarning} of ${a.reqs.length})`);
  note('Before the fix: warning at call 4, guard stop after 3 identical replies -> never delivered.');

  console.log('\n=== 3. continued identical actions still terminate within the existing bound ===');
  say(calls.length <= 6, `the run stopped after ${calls.length} identical calls - not extended by the fix`);

  // ── 2. A DIFFERENT, VALID ACTION AFTER THE WARNING EXECUTES NORMALLY ──
  console.log('\n=== 2. a different valid action after the warning executes normally ===');
  const recover = join(scratch('rw-recover'), 'replies.json'); dirs.push(dirname(recover));
  writeFileSync(recover, JSON.stringify([
    PLAN, OUTLINE, OUTLINE,                                   // repeat once -> warned
    'THOUGHT: I was warned I am repeating. Reading the file instead.\nACTION: read_file\nPATH: pascal.py',
    'THOUGHT: Done for this test.\nACTION: finish\nTEXT:\nread the file',
  ]), 'utf8');
  const b = await drive(recover, 'recover');
  const bt = toolCalls(b.run).map((s) => s.tool);
  say(bt.includes('read_file'), `after the warning, a DIFFERENT action executed (${bt.join(' -> ')})`);
  say(!stoppedByGuard(b.run), 'and the run was NOT stopped by the guard');
  say(b.run?.status === 'done', `it finished normally (${b.run?.status})`);

  // ── 4. THE ORDINARY SUCCESSFUL PATH IS UNCHANGED ──
  console.log('\n=== 4. the ordinary successful path is unchanged ===');
  const okFile = join(scratch('rw-ok'), 'replies.json'); dirs.push(dirname(okFile));
  writeFileSync(okFile, JSON.stringify([
    PLAN,
    'THOUGHT: Reading.\nACTION: read_file\nPATH: pascal.py',
    'THOUGHT: Done.\nACTION: finish\nTEXT:\nok',
  ]), 'utf8');
  const c = await drive(okFile, 'ok');
  say(toolCalls(c.run).map((s) => s.tool).join(',') === 'read_file', 'a single read executes once');
  say(!c.reqs.some((r) => hasWarning(newestUser(r))), 'no warning is ever sent on a non-repeating path');
  say(!c.reqs.some((r) => /THE HUB IS SHOWING YOU/.test(newestUser(r))), 'and no substitution fires');
  say(c.run?.status === 'done', `the run finishes (${c.run?.status})`);
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  repeat warning delivery: ${passed} passed, ${failed} failed -> ${failed ? 'THE MODEL CAN STILL BE STOPPED UNWARNED' : 'the warning reaches the model before termination'}`);
process.exit(failed ? 1 : 0);
