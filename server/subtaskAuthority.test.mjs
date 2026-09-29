/**
 * subtaskAuthority.test.mjs - WHAT AUTHORITY CURRENTLY DOES ACROSS spawn_subtask.
 *
 *   node server/subtaskAuthority.test.mjs
 *
 * THIS IS A CHARACTERIZATION TEST, NOT A SPECIFICATION. It documents the behaviour this slice has
 * today, including one property that is a DEFECT rather than a feature. It is written before any
 * step-5 mechanism exists so that the baseline is measured rather than remembered.
 *
 * WHY IT MATTERS. `runAuthorities` is module-scoped and installed in exactly one place (`startRun`).
 * The subtask loop calls `tools[tool](args)` directly and touches authority NOWHERE, so whatever the
 * parent holds is simply visible to the child. Reading the code says that; this makes it fire.
 *
 * THE TWO HALVES, and they point in opposite directions:
 *
 *   BOUNDED    a child cannot write outside the PARENT's scope. Ambient inheritance is not unlimited
 *              escalation - the parent's grant set is still the ceiling.
 *   AMBIENT    a child CAN write anything inside the parent's scope, including paths the child was
 *              never separately granted and the parent's own goal never mentioned. No delegation
 *              event is recorded, nothing narrows the scope to what the child needs, and the child's
 *              authority is indistinguishable from the parent's.
 *
 * The second half is the `sudo -E` hazard: parent was trusted, therefore child is trusted. It is the
 * thing step 5 has to attack, and it is asserted here as CURRENT BEHAVIOUR so that a later change has
 * something to contradict.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok    ' + what); } else { fail++; console.log('  FAIL  ' + what); } };

const freePort = () => new Promise((res) => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

const NL = '\n';
const wr = (path, body) => ['ACTION: write_file', 'PATH: ' + path, '```python', body, '```'].join(NL);
const sub = (goal) => ['ACTION: spawn_subtask', 'GOAL: ' + goal].join(NL);
const fin = ['ACTION: finish', 'SUMMARY: done'].join(NL);
const PLAN = ['1. Delegate one file', '2. FILES: a.py', '3. BUILD ORDER: 1) delegate',
  '4. HOW TO VERIFY: python a.py'].join(NL);

async function scenario(childTarget, writeScope) {
  // One mock, serving both the parent's calls and the sub-task's, in order.
  const SCRIPT = [
    PLAN,
    wr('a.py', 'def a():' + NL + '    return 1' + NL),   // parent, in scope -> lands
    sub('write ' + childTarget),                          // parent delegates
    wr(childTarget, 'def k():' + NL + '    return 2' + NL), // THE CHILD's write
    fin,                                                  // child finishes
    fin,                                                  // parent finishes
  ];

  const mockPort = await freePort(), hubPort = await freePort();
  let served = 0;
  const mock = createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'script', lora: null }));
    }
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const text = served < SCRIPT.length ? SCRIPT[served] : fin;
      served++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'script', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

  const dir = mkdtempSync(join(tmpdir(), 'subauth-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: 'http://127.0.0.1:' + mockPort, model: 'script' } }, history: [], settings: {},
  }), 'utf8');

  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
      AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'),
      RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '3',
      MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
      AGENT_GOVERNED_WRITES: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  hub.stdout.on('data', () => {}); hub.stderr.on('data', () => {});

  const API = 'http://127.0.0.1:' + hubPort + '/api';
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
  for (let i = 0; i < 240; i++) {
    try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  let run = null;
  try {
    const s = await api('/agent/start', {
      method: 'POST', body: JSON.stringify({ goal: 'Create a.py, then delegate.', writeScope }),
    });
    if (!s.runId) throw new Error('start failed: ' + JSON.stringify(s).slice(0, 200));
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && !run.busy) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally { hub.kill(); mock.close(); }

  const body = (p) => { const f = join(ws, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
  const steps = (run && run.steps) || [];
  const res = {
    run, served, a: body('a.py'), child: body(childTarget),
    subtaskSteps: steps.filter((x) => String(x.type).startsWith('subtask')).length,
    allText: steps.map((x) => String(x.text || '') + ' ' + String(x.result || '')).join(' | '),
    // Step TYPES only, so a fixture that happens to contain the word "delegate" in its goal text
    // cannot masquerade as a delegation record. The first version of this test made exactly that
    // mistake and reported my own prompt back to me as evidence.
    types: [...new Set(steps.map((x) => String(x.type)))],
    // What the parent record says about the sub-task's tool calls, verbatim.
    subtaskText: steps.filter((x) => String(x.type).startsWith('subtask'))
      .map((x) => String(x.text || '') + ' ' + String(x.result || '')).join(' | '),
  };
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
  return res;
}

console.log('authority across spawn_subtask — CURRENT behaviour, measured');

// ── 1. AMBIENT: the child writes a path INSIDE the parent's scope that it was never granted. ─────
const inside = await scenario('b.py', ['a.py', 'b.py']);
ok(inside.run !== null, 'the run reached a terminal state (status ' + (inside.run && inside.run.status) + ')');
ok(inside.subtaskSteps > 0, 'a sub-task actually ran (' + inside.subtaskSteps + ' subtask steps)');
ok(inside.a !== null, 'the parent write landed, so governance was not simply refusing everything');
ok(inside.child !== null,
  'AMBIENT INHERITANCE CONFIRMED: the sub-task wrote b.py using authority nothing granted to IT');
// The crossing leaves no AUTHORITY lineage. Asserted over step TYPES, not over free text: the first
// version of this assertion grepped /delegat/i across all step text and matched the word "delegate"
// in this file's own fixture goal, reporting my prompt back as evidence. Types cannot do that.
ok(!inside.types.some((t) => /authorit|delegat|grant|scope/i.test(t)),
  'NO AUTHORITY LINEAGE: no step TYPE records that authority crossed into the sub-task'
  + ' (types seen: ' + inside.types.join(', ') + ')');

// ── 2. BOUNDED: the child writes a path OUTSIDE the parent's scope. ──────────────────────────────
const outside = await scenario('d.py', ['a.py']);
ok(outside.a !== null, 'control: the parent write still landed in the bounded scenario');
ok(outside.child === null,
  'BOUNDED: the sub-task could NOT write d.py - the parent grant set is still the ceiling');
// A THIRD BEHAVIOUR FACT, AMENDED AT CANDIDATE-0 ASSEMBLY - and the amendment is the finding.
//
// ON integration/governed-slice this asserted the OPPOSITE, and passed 9/9:
//
//     ok(!/REFUSED by governance/.test(outside.allText),
//        'REFUSAL NOT VISIBLE: ... sub-task tool results are not carried up');
//
// That was an honest characterization of THAT branch, where `subtask_step` recorded only
// `  ↳ <tool> <path>` and dropped the result. It is preserved above rather than deleted, because
// what changed is the point.
//
// COMPOSITION CHANGED IT. consolidation/connect-components already carried a richer
// `subtask_step` that keeps `result: String(result ?? '').slice(0, 400)`. The slice supplied the
// refusal text; the other line supplied the carry-up. Assembled, the refusal reaches the parent
// run record.
//
// SCOPE OF THE CLAIM - CORRECTED. An earlier wording said this property exists ONLY in the
// assembly. THAT IS NOT SHOWN. What is measured:
//
//     governed-slice alone, this same assertion      8/9   (it lacks the recorder)
//     composed candidate                             9/9   (the merge preserved it)
//
// The converse arm was never run and cannot be run as written: consolidation alone has no
// issueWriteScope / multi-grant route, so this suite has nothing to generate the refusal with.
// So this is a REGRESSION-FREE COMPOSITION RESULT, not evidence of an emergent property.
//
// The supported claim: the composed candidate RETAINS visible governance refusal across subtask
// reporting. Establishing emergence would need a cross-line predicate - generate the refusal via
// the slice's authority route, assert the consolidation recorder exposes that SPECIFIC refusal,
// and show neither the old slice recorder nor an unguided route satisfies the same end-to-end
// predicate. Not done here, and not claimed.
ok(/REFUSED by governance/.test(outside.allText),
  'REFUSAL NOW VISIBLE (composition): the sub-task write was refused (d.py absent) AND the parent'
  + ' run record carries the refusal - slice refusal text + consolidation result carry-up');
ok(outside.subtaskText.length > 0,
  'the parent records THAT the sub-task acted, and now also what came back: '
  + outside.subtaskText.slice(0, 90));

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
console.log('');
console.log('READ THIS AS A BASELINE, NOT AN ENDORSEMENT. Half of it is the defect step 5 must attack:');
console.log('a child inherits the parent\'s whole scope, unnarrowed and unrecorded, simply by sharing');
console.log('module state. Parent was trusted, therefore child is trusted.');
process.exit(fail ? 1 : 0);
