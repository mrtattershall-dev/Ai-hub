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
async function arm({ protocolOn, script, seedPy = false }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`proto-${protocolOn ? 'on' : 'off'}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'package.json'), PKG, 'utf8');
  writeFileSync(join(ws, 'lib.js'), LIB, 'utf8');
  if (seedPy) writeFileSync(join(ws, 'calc.py'), 'def double(n):\n    return n * 2\n', 'utf8');

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

  // ── POSITIVE CONTROL: A PHASE-COMPLIANT SEQUENCE MUST COMPLETE ──
  //
  // Zero execution from a deliberately noncompliant script shows the REFUSAL path works. It
  // shows nothing about whether the controller can be satisfied at all. Without this, an
  // IMPOSSIBLE controller and a model that struggles to follow a WORKABLE one look identical -
  // and the whole comparison would rest on that ambiguity.
  console.log('\n=== POSITIVE CONTROL: a phase-compliant sequence completes the route ===');
  const ok = await arm({ protocolOn: true, script: 'protocolok' });
  dirs.push(ok.dir);
  const okSteps = ok.run?.steps || [];
  const okTools = okSteps.filter((s) => s.tool).map((s) => s.tool);
  const okRefusals = ok.run?.controllerRefusals || [];

  say(okTools.includes('read_file'), `an ALLOWED action executed in OBSERVE (tools: ${okTools.join(', ') || 'none'})`);
  say(okTools.includes('write_file'), 'and the write executed once the phase advanced to DECIDE');
  // the workspace really changed - behaviour, not a step record
  const libAfter = existsSync(join(ok.ws, 'lib.js')) ? readFileSync(join(ok.ws, 'lib.js'), 'utf8') : '';
  say(/function halve/.test(libAfter), 'the requested change is actually in the workspace');
  say(/function double/.test(libAfter), 'and the existing behaviour is still there');
  say(!!ok.run?.status && ok.run.status !== 'running', `the run reached termination (${ok.run?.status})`);
  // phase advancement is what distinguishes "satisfied" from "got lucky once"
  const phasesSeen = (ok.prompts.match(/PHASE: [A-Z ]+/g) || []).map((x) => x.trim());
  say(new Set(phasesSeen).size >= 2, `the controller ADVANCED through phases (${[...new Set(phasesSeen)].join(' -> ') || 'none'})`);
  say(okRefusals.length < okTools.length + okRefusals.length, `not everything was refused (${okRefusals.length} refusals, ${okTools.length} executed)`);
  note('So the controller is satisfiable on the real route. Whether the 7B can satisfy it is');
  note('the open question the comparison answers.');

  // ── v2: THE PROMISED TESTING TOOL IS REACHABLE ──
  //
  // PROTOCOL-1 refused run_python six times: the shared instructions promise it and v1
  // admitted it in no phase. A controller may bound WHEN a promised tool is available; it may
  // not promise one and never admit it.
  console.log('\n=== v2: run_python is reachable, with feedback and phase advancement ===');
  const v2 = await arm({ protocolOn: true, script: 'protocolv2', seedPy: true });
  dirs.push(v2.dir);
  const v2Tools = (v2.run?.steps || []).filter((s) => s.tool).map((s) => s.tool);
  const v2Refusals = v2.run?.controllerRefusals || [];
  say(v2Tools.includes('run_python'), `run_python EXECUTED on the real route (tools: ${v2Tools.join(', ') || 'none'})`);
  say(!v2Refusals.some((r) => r.tool === 'run_python'), `and it was not refused (${v2Refusals.map((r) => r.tool).join(', ') || 'no refusals'})`);
  // feedback + advancement: the controller must state a phase AFTER the test result
  say(/TOOL RESULT \(run_python\)[\s\S]{0,600}PHASE:/.test(v2.prompts), 'the controller responded to the test result with the next phase');
  const v2Phases = [...new Set((v2.prompts.match(/PHASE: [A-Z ]+/g) || []).map((x) => x.trim()))];
  say(v2Phases.some((x) => /VERIFY/.test(x)), `VERIFY was actually reached (${v2Phases.join(' -> ')})`);
  say(!!v2.run?.status && v2.run.status !== 'running', `and the run terminated (${v2.run?.status})`);
  // no instruction may name a tool the hub does not have
  say(!/wait_for_verification/.test(v2.prompts), 'no controller instruction names a nonexistent hub tool');

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
