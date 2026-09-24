/**
 * governedRun.test.mjs - THE CAMPAIGN'S ACCEPTANCE PATH GOVERNS RUNS STARTED FROM THE HUB.
 *
 *   node server/governedRun.test.mjs
 *
 * COMPONENT-CONNECTIONS.md: evaluator, acceptance and rollback were RUNNERS-ONLY. A UI-started
 * run could finish with a broken workspace and nothing said so. Through the REAL /agent/start
 * route, with scripted replies and the isolated worker:
 *
 *   1. an ordinary run is labelled NONE, in words, and gets no acceptance fields
 *   2. a governed start whose protected check FAILS on the starting state is BLOCKED (409),
 *      no run is created, the workspace is untouched
 *   3. a governed start on a hub without the qualified path is BLOCKED
 *   4. malformed checks are BLOCKED with the reason
 *   5. governed, the model BREAKS protected behaviour: candidate FAIL recorded, workspace
 *      RESTORED to the verified start, surviving protected PASS, run labelled with the disposition
 *   6. governed, the model FIXES the requested behaviour: RETAIN, counts as completion
 *   7. governed, the model does nothing useful: PRESERVE_INCOMPLETE, not a completion
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

const SEED = 'def f():\n    return 41\n\ndef g():\n    return 1\n';
const CHECK = (expr) => `import importlib.util\nspec = importlib.util.spec_from_file_location("m", "/candidate/m.py")\nm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nraise SystemExit(0 if (${expr}) else 1)\n`;
const CHECKS = {
  requested: { script: 'python3 /check/req.py', files: { 'req.py': CHECK('m.f() == 42') } },
  protected: { script: 'python3 /check/prot.py', files: { 'prot.py': CHECK('m.g() == 1') } },
};
const PLAN = '1. WHAT IT DOES - m.py\n2. FILES - m.py\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run';
const EDIT = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: m.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';

async function drive({ replies, seed = SEED, governed, env = {}, label, goal = 'Make f() in m.py return 42. Keep g() working.' }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`gov-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  if (seed !== null) writeFileSync(join(ws, 'm.py'), seed, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: process.env });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1', ...env } });
    hub = started.hub;
    const { api, base } = started;
    const r = await fetch(base + '/agent/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal, ...(governed ? { governed } : {}) }) });
    const start = await r.json();
    if (!start.runId) return { start, status: r.status, ws, run: null };
    let run = null;
    for (let i = 0; i < 180; i++) {
      run = await api(`/agent/${start.runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(1000);
    }
    return { start, status: r.status, ws, run, onDisk: existsSync(join(dir, 'runs', `${start.runId}.json`)) ? JSON.parse(readFileSync(join(dir, 'runs', `${start.runId}.json`), 'utf8')) : null };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}

try {
  console.log('=== 1. an ordinary run is labelled unprotected, in words ===');
  const a = await drive({ replies: [PLAN, FINISH], label: 'plain' });
  say(a.run?.protection === 'NONE', `protection NONE (${a.run?.protection})`);
  say(/No behavioral acceptance protection/.test(a.run?.protectionNote || ''), 'the note says so in words');
  say(!a.run?.governance && !a.run?.governed, 'no acceptance fields');

  console.log('\n=== 2. a start whose protected check fails on the seed is BLOCKED ===');
  const b = await drive({ replies: [PLAN, FINISH], seed: 'def f():\n    return 41\n\ndef g():\n    return 0\n', governed: { checks: CHECKS }, label: 'badseed' });
  say(b.status === 409 && b.start.blocked === true, `409 blocked (${b.status})`);
  say(/protected check FAILS on the starting state/.test(b.start.error || ''), `with the reason: ${String(b.start.error).slice(0, 80)}`);
  say(!b.start.runId, 'no run was created');
  say(readFileSync(join(b.ws, 'm.py'), 'utf8').includes('return 0'), 'the workspace is untouched');

  console.log('\n=== 3. a start on a hub without the qualified path is BLOCKED ===');
  const c = await drive({ replies: [PLAN, FINISH], governed: { checks: CHECKS }, env: { AGENT_WORKER_EXEC: '', AGENT_BOUND_ROUTES: '' }, label: 'unqualified' });
  say(c.status === 409 && /qualified execution path/.test(c.start.error || ''), `409 with the reason (${String(c.start.error).slice(0, 70)})`);

  console.log('\n=== 4. malformed checks are BLOCKED with the reason ===');
  const d = await drive({ replies: [PLAN, FINISH], governed: { checks: { requested: { script: 'x' } } }, label: 'malformed' });
  say(d.status === 409 && /protected: missing/.test(d.start.error || ''), `409: ${String(d.start.error).slice(0, 80)}`);

  console.log('\n=== 5. governed: the model breaks protected behaviour -> captured, RESTORED, recheck ===');
  const e = await drive({ replies: [PLAN, EDIT('    return 1', '    return 999'), FINISH], governed: { checks: CHECKS }, label: 'break' });
  say(e.run?.protection === 'BEHAVIORAL_ACCEPTANCE', `protection BEHAVIORAL_ACCEPTANCE (${e.run?.protection})`);
  say(e.run?.governance?.candidateVerdict?.protected === 'FAIL', `candidate protected FAIL recorded (${e.run?.governance?.candidateVerdict?.protected})`);
  say(e.run?.governance?.disposition === 'RESTORED', `disposition RESTORED (${e.run?.governance?.disposition})`);
  const restored = readFileSync(join(e.ws, 'm.py'), 'utf8');
  say(restored === SEED, `the workspace is byte-identical to the verified start${restored === SEED ? '' : ` (got ${JSON.stringify(restored).slice(0, 120)})`}`);
  say(e.run?.governance?.survivingWorkspaceVerdict?.protected === 'PASS', 'surviving workspace protected PASS (the recheck)');
  say(e.run?.governance?.candidateVerdict?.candidateTree && e.run.governance.candidateVerdict.candidateTree !== e.run.governance.survivingWorkspaceVerdict?.candidateTree, 'both verdicts name different trees');
  say((e.run?.steps || []).some((s) => s.type === 'acceptance' && /RESTORED/.test(s.text)), 'an acceptance step is visible on the run');
  say(Array.isArray(e.onDisk?.governance ? [1] : null), 'the governance record is on disk with the run');
  note(`start tree ${String(e.run?.governed?.startTree).slice(0, 12)}; captured at ${e.run?.governance?.capturedAt || '-'}`);

  console.log('\n=== 6. governed: the model fixes the requested behaviour -> RETAIN ===');
  const f = await drive({ replies: [PLAN, EDIT('    return 41', '    return 42'), FINISH], governed: { checks: CHECKS }, label: 'fix' });
  say(f.run?.governance?.disposition === 'RETAIN', `disposition RETAIN (${f.run?.governance?.disposition})`);
  say(f.run?.governance?.countsAsCompletion === true, 'counts as a completion');
  say(/return 42/.test(readFileSync(join(f.ws, 'm.py'), 'utf8')), 'the fix survived');
  say(f.run?.governed?.startVerdict?.requested === 'FAIL' && f.run?.governed?.startVerdict?.protected === 'PASS', 'the start verdict was recorded (requested FAIL, protected PASS)');

  console.log('\n=== 7. governed: nothing useful -> PRESERVE_INCOMPLETE ===');
  const g = await drive({ replies: [PLAN, FINISH], governed: { checks: CHECKS }, label: 'idle' });
  say(g.run?.governance?.disposition === 'PRESERVE_INCOMPLETE', `disposition PRESERVE_INCOMPLETE (${g.run?.governance?.disposition})`);
  say(g.run?.governance?.countsAsCompletion === false, 'not a completion');
  say(/PROTECTED|acceptance/i.test(g.run?.protectionNote || '') && /PRESERVE_INCOMPLETE/.test(g.run?.protectionNote || ''), 'the note carries the disposition');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  governed run: ${passed} passed, ${failed} failed -> ${failed ? 'UI RUNS ARE NOT GOVERNED BY THE ACCEPTANCE PATH' : 'declared checks + verified start govern hub runs; unprotected runs say so'}`);
process.exit(failed ? 1 : 0);
