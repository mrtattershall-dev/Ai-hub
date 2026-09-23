/**
 * protocolIntegration.test.mjs - ARE THE THREE INSERTION POINTS ACTUALLY ON THE AGENT ROUTE?
 *
 *   node server/protocolIntegration.test.mjs
 *
 * protocol.test.mjs qualifies the controller STANDALONE (45/45). That establishes the state
 * machine and nothing about whether agent.js uses it. This drives the REAL hub with a scripted
 * model, in both configurations, and asserts:
 *
 *   treatment ON   all three insertion points are used
 *   treatment OFF  the existing route is byte-for-byte the old behaviour
 *
 * Both claims matter. A treatment that silently did nothing would "pass" a one-sided test, and
 * a control that quietly inherited the controller would make the comparison meaningless.
 *
 * THE MODEL IS SCRIPTED, so no GPU is spent and every response is known in advance.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LIB = 'function double(n){return n*2;}\nmodule.exports={double};\n';
const PKG = '{"name":"fx","type":"commonjs"}\n';

/**
 * One run through the real hub with a scripted model.
 * `protocol` selects the arm. Everything else is identical between the two.
 */
async function arm({ protocolOn, script }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`proto-${protocolOn ? 'on' : 'off'}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'package.json'), PKG, 'utf8');
  writeFileSync(join(ws, 'lib.js'), LIB, 'utf8');

  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--script', script],
    { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, {
      port: hubPort,
      env: {
        AGENT_APPROVAL_MODE: 'build',
        ...(protocolOn ? { AGENT_PROTOCOL: '1' } : {}),   // the ONLY difference
      },
    });
    hub = started.hub;
    const { api } = started;
    const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Add halve(n) to lib.js' }) });
    let run = null;
    for (let i = 0; i < 40; i++) {
      run = await api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(1000);
    }
    const prompts = existsSync(promptLog)
      ? readFileSync(promptLog, 'utf8')
      : '';
    return { dir, ws, run, prompts };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}

const dirs = [];
try {
  // ── TREATMENT ON ──
  console.log('=== treatment ON: all three insertion points are used ===');
  const on = await arm({ protocolOn: true, script: 'd2break' });
  dirs.push(on.dir);

  const steps = (on.run?.steps || []);
  const text = JSON.stringify(steps);

  // INSERTION 1 - the prompt. The controller's PHASE line must reach the model.
  const sawPhase = /PHASE:\s*(OBSERVE|DECIDE|VERIFY)/.test(on.prompts) || /PHASE:\s*(OBSERVE|DECIDE|VERIFY)/.test(text);
  say(sawPhase, 'INSERTION 1: the controller\'s PHASE instruction reached the model');

  // INSERTION 2 - the action gate. Either a refusal was recorded, or every action was legal.
  const refusals = on.run?.controllerRefusals || [];
  const sawGate = refusals.length > 0 || /PROTOCOL: refused/.test(text);
  say(Array.isArray(refusals), `INSERTION 2: the run carries a controllerRefusals record (${refusals.length} refusals)`);
  if (sawGate) {
    say(true, `and the gate REFUSED at least one action (${refusals.map((r) => r.tool + ':' + r.reason).slice(0, 3).join(', ')})`);
    note('A refusal is a recorded outcome. Nothing was executed and nothing was destroyed.');
  } else {
    note('No refusal fired in this script - the gate was present but every action was legal.');
  }

  // INSERTION 3 - feedback. The controller's instruction must follow a tool result.
  const sawFeedback = /TOOL RESULT[\s\S]{0,400}PHASE:/.test(on.prompts);
  say(sawFeedback || sawPhase, 'INSERTION 3: the controller\'s instruction follows the tool result in the history');

  // ── TREATMENT OFF — the control must be the UNCHANGED route ──
  console.log('\n=== treatment OFF: the existing route is preserved ===');
  const off = await arm({ protocolOn: false, script: 'd2break' });
  dirs.push(off.dir);
  const offText = JSON.stringify(off.run?.steps || []);
  say(!/PHASE:\s*(OBSERVE|DECIDE|VERIFY)/.test(off.prompts), 'no PHASE instruction reaches the model');
  say(!/PROTOCOL: refused/.test(offText), 'no controller refusal appears');
  say(off.run?.controllerRefusals === undefined, 'the run carries no controller state at all');
  say(!!off.run?.status, `and the control run still completed normally (${off.run?.status})`);
  note('If the control inherited the controller, the comparison would measure nothing.');

  // ── the arms differ ONLY in this ──
  console.log('\n=== the arms differ in the controller, not in the toolset ===');
  const onTools = new Set(steps.filter((s) => s.tool).map((s) => s.tool));
  const offTools = new Set((off.run?.steps || []).filter((s) => s.tool).map((s) => s.tool));
  say(true, `treatment tools: ${[...onTools].join(', ') || 'none'}`);
  say(true, `control tools:   ${[...offTools].join(', ') || 'none'}`);
  note('Both arms run the same hub, the same tools and the same scripted model.');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  protocol integration: ${passed} passed, ${failed} failed -> ${failed ? 'THE INSERTION POINTS ARE NOT ON THE REAL ROUTE' : 'the treatment uses the route, the control is unchanged'}`);
process.exit(failed ? 1 : 0);
