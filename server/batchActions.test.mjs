/**
 * batchActions.test.mjs - the run loop executing several actions from ONE reply (opt-in).
 *
 *   node server/batchActions.test.mjs
 *
 * AGENT_BATCH_ACTIONS=1 makes the loop run a reply's actions in order instead of only the
 * first. This drives the REAL loop - an isolated hub, a mock Ollama on a free port - once with
 * the flag on and once with it off. The mock serves crafted replies, each built so that one
 * rule going missing changes what lands on disk or what the model is told, plus every real
 * multi-action reply in the recorded corpus.
 *
 *   flag ON   several actions run from one model turn; the batch stops at the first failure;
 *             `finish` is never executed from inside a batch; approval and policy still gate
 *             (and end the batch); the per-turn cap holds; the dropped-action nudge names only
 *             actions that really did not run.
 *   flag OFF  exactly one action per turn and the nudge exactly as before.
 *   both      nothing destroyed - checkInvariants on the run directory (ESM: ignored, a known
 *             artifact of corpus replies recorded before the prompt said "CommonJS").
 *
 * How "one turn" is observed: the mock records every request. The message that follows the
 * batch reply in the NEXT request is everything the hub sent back before calling the model
 * again, so three results in it means three actions ran in that one turn.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { freePorts } from './testPort.mjs';
import { parseActions } from './agentParse.js';
import { checkInvariants } from './fuzzInvariants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 700)}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed'];

// ── crafted replies ─────────────────────────────────────────────────────────────
const js = (body) => '```javascript\n' + body + '\n```';
const write = (path, body) => `THOUGHT: writing ${path}.\nACTION: write_file\nPATH: ${path}\n${js(body)}`;
const edit = (path, find, repl) => `THOUGHT: editing ${path}.\nACTION: edit_file\nPATH: ${path}\nFIND:\n${js(find)}\nREPLACE:\n${js(repl)}`;
const cmd = (c) => `THOUGHT: running it.\nACTION: run_command\nCOMMAND: ${c}`;
const finish = (summary) => `THOUGHT: that is everything.\nACTION: finish\nSUMMARY: ${summary}`;
const reply = (...parts) => parts.join('\n\n');

const R = {
  several: reply(write('s1_a.js', 'const a = 1;\nmodule.exports = { a };'),
    write('s1_b.js', 'const b = 2;\nmodule.exports = { b };'), cmd('node s1_a.js')),
  // Three ways to fail, each followed by an action that must NOT run.
  stopOnError: reply(write('s2_ok.js', 'module.exports = { ok: true };'),
    edit('s2_ok.js', 'this text is not in the file', 'nor is this'), write('s2_never.js', 'module.exports = 1;')),
  stopOnMarker: reply('THOUGHT: switch to ESM.\nACTION: write_file\nPATH: package.json\n```json\n{"type":"module"}\n```',
    write('s2m_never.js', 'module.exports = 1;')),
  stopOnExit: reply(cmd('node -e "process.exit(3)"'), write('s2x_never.js', 'module.exports = 1;')),
  finishHeld: reply(write('s3_done.js', 'module.exports = { done: true };'), finish('BATCHED-FINISH-MUST-NOT-RUN')),
  // `frobnicate` is on no allowlist, so build mode ASKS; `rm -rf` is refused outright.
  approval: reply(write('s4_before.js', 'module.exports = 1;'), cmd('frobnicate --now'), write('s4_after.js', 'module.exports = 2;')),
  denied: reply(write('s4d_before.js', 'module.exports = 1;'), cmd('rm -rf s4d_before.js'), write('s4d_after.js', 'module.exports = 2;')),
  overCap: reply(...[1, 2, 3, 4, 5, 6].map((i) => write(`s5_${i}.js`, `module.exports = ${i};`))),
  // The real shape parseActions has to merge: ONE edit whose FIND and REPLACE are separated
  // by a stray `ACTION:` header. Two headers, one action.
  strayBase: write('s7.js', 'function add(a, b) { return a + b; }\nfunction sub(a, b) { return a - b; }\nmodule.exports = { add };'),
  strayEdit: 'THOUGHT: export sub too.\nACTION: edit_file\nPATH: s7.js\nFIND:\n' + js('module.exports = { add };')
    + '\nACTION: edit_file\nPATH: s7.js\nREPLACE:\n' + js('module.exports = { add, sub };'),
};

const rows = existsSync(CORPUS) ? readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const corpusMulti = rows.filter((r) => parseActions(r.text, null, 1000).length >= 2);
const CORPUS_N = parseInt(process.env.BATCH_CORPUS_N || String(corpusMulti.length), 10);
const GOALS = [
  'Create p1_calc.js exporting add(a,b) and mul(a,b), with self-checks that throw. Verify with node.',
  'Add sub(a,b) to the EXISTING p1_calc.js, keeping add and mul unchanged. Verify.',
  'Write P1.md documenting every function that really exists in p1_calc.js. Read the file first.',
];

// ── rig: a mock model + an isolated hub ───────────────────────────────────────────
async function startRig(batchOn) {
  const [mockPort, hubPort] = await freePorts(2);
  const rig = { batchOn, script: [], requests: [], k: 0, log: [] };
  rig.mock = createServer((req, res) => {
    if (!/\/api\/chat/.test(req.url)) {                  // health / probes: never consume a reply
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'batch', lora: null, models: [] }));
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let messages = [];
      try { messages = JSON.parse(body).messages || []; } catch { /* recorded as empty */ }
      // The plan-first gate sends [system, user]; every turn carries the growing history.
      const planner = messages.length === 2;
      const text = planner ? 'Plan: do what the goal says, then finish.'
        : (rig.script.length ? rig.script.shift() : finish(`scripted finish ${++rig.k}`));
      rig.requests.push({ planner, messages, reply: text });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'batch', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((r) => rig.mock.listen(mockPort, '127.0.0.1', r));

  rig.dir = mkdtempSync(join(tmpdir(), `batch-${batchOn ? 'on' : 'off'}-`));
  rig.ws = join(rig.dir, 'workspace');
  writeFileSync(join(rig.dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'batch' } }, history: [], settings: {},
  }), 'utf8');
  rig.hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(hubPort), HUB_DB: join(rig.dir, 'hub.json'),
      AGENT_WORKSPACE: rig.ws, AGENT_QUEUE_FILE: join(rig.dir, 'queue.json'),
      AGENT_RUNS_DIR: join(rig.dir, 'runs'), AGENT_TRACES_DIR: join(rig.dir, 'traces'), RUN_INDEX: join(rig.dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      AGENT_BATCH_ACTIONS: batchOn ? '1' : '0',
      AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '5',
      MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rig.hub.stdout.on('data', (d) => rig.log.push(d.toString()));
  rig.hub.stderr.on('data', (d) => rig.log.push(d.toString()));
  rig.API = `http://127.0.0.1:${hubPort}/api`;
  rig.up = false;
  for (let i = 0; i < 240 && !rig.up; i++) {
    try { await fetch(rig.API + '/auth/hint'); rig.up = true; } catch { await sleep(250); }
  }
  return rig;
}
const api = async (rig, p, o) => (await fetch(rig.API + p, {
  headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000),
})).json();

// Start a run, serve `script` to it (then lone finishes), deny every approval it asks for, and
// wait for it to end. `onApproval` sees the run AT the moment it is parked.
async function runGoal(rig, goal, script, { onApproval } = {}) {
  rig.script = [...script];
  const from = rig.requests.length;
  const s = await api(rig, '/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 200));
  const deadline = Date.now() + 5 * 60000;
  let run = null;
  while (Date.now() < deadline) {
    run = await api(rig, '/agent/' + s.runId).catch(() => null);
    if (run?.status === 'awaiting_approval') {
      if (onApproval) onApproval(run);
      await api(rig, `/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: false }) });
      continue;
    }
    // Wait for teardown too: main now answers the next /start with a 409 until busy clears.
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  assert.ok(run && TERMINAL.includes(run.status), `run never ended (last status ${run?.status})`);
  return { run, reqs: rig.requests.slice(from) };
}

// What the hub sent back after `text`: the message right after that assistant reply, in the
// first later request that carries it.
const answerTo = (reqs, text) => {
  for (const r of reqs) {
    const i = r.messages.findIndex((m) => m.role === 'assistant' && String(m.content).trim() === text.trim());
    if (i !== -1 && r.messages[i + 1]) return String(r.messages[i + 1].content);
  }
  return null;
};
const has = (rig, f) => existsSync(join(rig.ws, f));
const batchNotes = (run) => run.steps.filter((s) => s.type === 'note' && s.batch);
const executed = (run) => run.steps.filter((s) => ['tool', 'policy_denied', 'approval_request'].includes(s.type)
  || (s.type === 'error' && /^Unknown tool/.test(s.text || ''))).length;
const turns = (reqs) => reqs.filter((r) => !r.planner).length;

// RULE 3, checked on every run rather than only the crafted one: a run that ended on a model
// `finish` ended on the LAST reply served to it, and that reply must not be a multi-action
// reply whose finish came after other actions.
const finishedFromBatch = ({ run, reqs }) => {
  if (!run.steps.some((s) => s.type === 'finish' && s.thought !== 'auto')) return false;
  const last = [...reqs].reverse().find((r) => !r.planner);
  const acts = last ? parseActions(last.reply, null, 1000) : [];
  return acts.length > 1 && acts[0].tool !== 'finish';
};

function invariantsClean(rig) {
  const v = checkInvariants(rig.dir, { hubExitCode: rig.hub.exitCode, hubLog: rig.log.join('') })
    .filter((x) => !x.startsWith('ESM:'));
  assert.deepEqual(v, [], `damage found in ${rig.dir}:\n${v.join('\n')}`);
}

function stopRig(rig) { try { rig.hub.kill(); } catch { /* already gone */ } rig.mock.close(); }

// ═════════════════════════════════════════════════════════════════════════════════
console.log('\nbatch actions vs. the real loop (offline)\n');
console.log(`  corpus: ${rows.length} replies, ${corpusMulti.length} carry more than one action (serving ${Math.min(CORPUS_N, corpusMulti.length)})\n`);
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const served = corpusMulti.slice(0, CORPUS_N);

// ── flag ON ─────────────────────────────────────────────────────────────────────
const on = await startRig(true);
const onRuns = [];
await test('ON: the hub starts against the mock', () => assert.ok(on.up, 'hub never came up:\n' + on.log.join('').slice(-500)));

await test('ON: several actions run from ONE model turn', async () => {
  const out = await runGoal(on, 'Create s1_a.js and s1_b.js, then run s1_a.js.', [R.several]); onRuns.push(out);
  assert.ok(has(on, 's1_a.js') && has(on, 's1_b.js'), 'only the first action ran');
  const fb = answerTo(out.reqs, R.several);
  assert.ok(fb, 'the model was never called again after the batch reply');
  assert.equal((fb.match(/TOOL RESULT \(write_file\)/g) || []).length, 2, `both writes should report in the one answer:\n${fb.slice(0, 600)}`);
  assert.match(fb, /TOOL RESULT \(run_command\)/, 'the run_command did not run in the same turn');
  assert.match(fb, /You sent 3 actions in one response/);
  assert.match(fb, /All 3 actions ran/);
  assert.doesNotMatch(fb, /DISCARDED/, 'the dropped-action nudge claims actions were discarded that actually ran');
  const note = batchNotes(out.run)[0];
  assert.ok(note && note.batch.ran === 3, `batch note: ${JSON.stringify(note)}`);
});

await test('ON: the batch stops at the first action that fails', async () => {
  const out = await runGoal(on, 'Create s2_ok.js.', [R.stopOnError, R.stopOnMarker, R.stopOnExit]); onRuns.push(out);
  assert.ok(has(on, 's2_ok.js'), 'the action before the failure should have run');
  const editStep = out.run.steps.find((s) => s.type === 'tool' && s.tool === 'edit_file' && s.args?.path === 's2_ok.js');
  assert.ok(editStep && /^ERROR/.test(editStep.result), `the FIND-miss edit should have returned ERROR: ${editStep?.result?.slice(0, 120)}`);
  assert.ok(!has(on, 's2_never.js'), 'an action after a failed edit_file ran anyway');
  assert.ok(!has(on, 's2m_never.js'), 'an action after the marker-guard refusal ran anyway');
  assert.ok(!has(on, 's2x_never.js'), 'an action after a command that exited non-zero ran anyway');
  const fb = answerTo(out.reqs, R.stopOnError);
  assert.match(fb, /#3 write_file s2_never\.js: NOT run - the batch stopped because #2 edit_file returned an error/);
  const stops = batchNotes(out.run).map((n) => n.batch.stop || '');
  assert.ok(stops.some((s) => /#1 run_command exited non-zero/.test(s)), `stops: ${JSON.stringify(stops)}`);
});

await test('ON: finish is never executed from inside a batch', async () => {
  const out = await runGoal(on, 'Create s3_done.js, then finish.', [R.finishHeld]); onRuns.push(out);
  assert.ok(has(on, 's3_done.js'), 'the action before the finish should have run');
  const fins = out.run.steps.filter((s) => s.type === 'finish');
  assert.ok(!fins.some((s) => /BATCHED-FINISH-MUST-NOT-RUN/.test(s.summary || '')),
    'the finish written in the same reply as a write was EXECUTED - the run declared success blind');
  const fb = answerTo(out.reqs, R.finishHeld);
  assert.ok(fb, 'the run ended on the batched finish - the model was never asked again');
  assert.match(fb, /#2 finish: HELD, not executed/);
  assert.ok(batchNotes(out.run).some((n) => n.batch.held), 'no batch note recorded the held finish');
});

await test('ON: approval-gated and refused actions still gate, and end the batch', async () => {
  const seen = [];
  const out = await runGoal(on, 'Create s4_before.js and s4_after.js.', [R.approval, R.denied], {
    onApproval: (live) => seen.push({ pending: live.pending, before: has(on, 's4_before.js'), after: has(on, 's4_after.js') }),
  });
  onRuns.push(out);
  assert.ok(seen.length >= 1, 'the run never parked for approval - the gated command was not gated');
  assert.equal(seen[0].pending?.tool, 'run_command');
  assert.equal(seen[0].pending?.args?.cmd, 'frobnicate --now');
  assert.ok(seen[0].before, 'the action BEFORE the gated one should have run');
  assert.ok(!seen[0].after, 'the action AFTER the gated one ran while the run waited for a human');
  assert.ok(!has(on, 's4_after.js'), 'the rest of the batch ran once the approval was answered');
  assert.ok(!out.run.steps.some((s) => s.type === 'tool' && s.args?.cmd === 'frobnicate --now'), 'the gated command executed');
  const fb = answerTo(out.reqs, R.approval);
  assert.match(fb, /#2 run_command frobnicate --now needs human approval/);
  assert.match(fb, /#3 write_file s4_after\.js: NOT run/);
  assert.ok(out.run.steps.some((s) => s.type === 'policy_denied' && /rm -rf/.test(s.args?.cmd || '')), 'rm -rf was not refused');
  assert.ok(has(on, 's4d_before.js'), 'the refused rm -rf ran');
  assert.ok(!has(on, 's4d_after.js'), 'an action after a policy refusal ran anyway');
});

await test('ON: at most 4 actions run from one reply', async () => {
  const out = await runGoal(on, 'Create s5_1.js through s5_6.js.', [R.overCap]); onRuns.push(out);
  for (const i of [1, 2, 3, 4]) assert.ok(has(on, `s5_${i}.js`), `s5_${i}.js should have run`);
  for (const i of [5, 6]) assert.ok(!has(on, `s5_${i}.js`), `s5_${i}.js ran past the cap`);
  assert.match(answerTo(out.reqs, R.overCap), /#5 write_file s5_5\.js: NOT run - over the limit of 4/);
});

await test('ON: a stray ACTION: line inside one edit is not reported as a dropped action', async () => {
  const out = await runGoal(on, 'Export sub from s7.js too.', [R.strayBase, R.strayEdit]); onRuns.push(out);
  const fb = answerTo(out.reqs, R.strayEdit);
  assert.match(fb, /TOOL RESULT \(edit_file\):\nOK/, `the edit should have applied:\n${String(fb).slice(0, 300)}`);
  assert.doesNotMatch(fb, /DISCARDED/, 'the nudge reports an action that never existed');
  assert.match(readFileSync(join(on.ws, 's7.js'), 'utf8'), /module\.exports = \{ add, sub \}/);
});

await test(`ON: ${served.length} real multi-action replies from the corpus`, async () => {
  const runs = [];
  for (const [i, chunk] of chunks(served, 10).entries()) runs.push(await runGoal(on, GOALS[i % GOALS.length], chunk.map((r) => r.text)));
  onRuns.push(...runs);
  const notes = runs.flatMap((o) => batchNotes(o.run));
  console.log(`        ${runs.length} runs, ${runs.reduce((n, o) => n + turns(o.reqs), 0)} turns, ${notes.length} batches: `
    + `${notes.filter((n) => n.batch.ran > 1).length} ran >1 action, ${notes.filter((n) => n.batch.held).length} held a finish, `
    + `${notes.filter((n) => n.batch.stop).length} stopped early`);
  assert.ok(notes.some((n) => n.batch.ran > 1), 'no real reply ever ran more than one action');
  assert.ok(notes.some((n) => n.batch.held), 'no real reply with a trailing finish was served - rule 3 untested on real data');
  assert.ok(runs.some((o) => executed(o.run) > turns(o.reqs)), 'no corpus run executed more actions than it had turns');
});

await test('ON: no run anywhere ended on a finish from a multi-action reply', () => {
  const bad = onRuns.filter(finishedFromBatch);
  assert.equal(bad.length, 0, `finished from a batch: ${bad.map((o) => o.run.id).join(', ')}`);
});

await test('ON: nothing destroyed (checkInvariants)', () => invariantsClean(on));
stopRig(on);

// ── flag OFF: today's behaviour ───────────────────────────────────────────────────
const off = await startRig(false);
const offRuns = [];
await test('OFF: the hub starts against the mock', () => assert.ok(off.up, 'hub never came up:\n' + off.log.join('').slice(-500)));

await test('OFF: exactly one action per turn - the rest dropped with the nudge, as before', async () => {
  const out = await runGoal(off, 'Create s1_a.js and s1_b.js, then run s1_a.js.', [R.several, R.finishHeld]); offRuns.push(out);
  assert.ok(has(off, 's1_a.js'), 'the first action should run');
  assert.ok(!has(off, 's1_b.js'), 'a second action ran with the flag OFF');
  assert.ok(!out.run.steps.some((s) => s.type === 'tool' && s.tool === 'run_command'), 'a third action ran with the flag OFF');
  assert.match(answerTo(out.reqs, R.several), /You sent 3 actions in one response\. ONLY THE FIRST \(write_file\) was executed — the other 2 were DISCARDED/);
  assert.ok(has(off, 's3_done.js'));
  assert.ok(!out.run.steps.some((s) => s.type === 'finish' && /BATCHED-FINISH-MUST-NOT-RUN/.test(s.summary || '')));
  assert.equal(batchNotes(out.run).length, 0, 'batch bookkeeping ran with the flag OFF');
});

// REWRITTEN 2026-09-12. This test was called "the nudge still counts raw ACTION: headers
// (unchanged)" and asserted that a stray ACTION: line inside ONE edit is reported as a second,
// discarded action. That was a SCOPE guard for the batch work - "my opt-in feature did not disturb
// the default path" - and it ended up being the last thing pinning a defect in place.
//
// The defect: `dropped` read `!BATCH_ACTIONS ? extraActions : ...`, so the accurate counter
// (parseActions) was wired to the OPT-IN path and the naive ACTION-header regex stayed the DEFAULT.
// The comment beside it even explained why the regex is wrong - a stray ACTION: line in the middle
// of one edit_file, 5 of the 102 real multi-action replies - and then used it anyway.
//
// It is not cosmetic. The nudge says "ONLY THE FIRST was executed - the other N were DISCARDED and
// did NOT happen" and tells the model to resend. Say that about an edit that fully applied and the
// model resends a landed edit, which is how the repeat guard gets fed.
//
// So OFF now asserts what ON already asserted twelve lines up: the edit applied, and nothing claims
// an action that never existed. The genuine multi-action case above ("OFF: exactly one action per
// turn") is untouched and still demands "the other 2 were DISCARDED" - that is the control proving
// this change narrowed a FALSE claim rather than blunting a true one.
await test('OFF: a stray ACTION: line inside one edit is not reported as a dropped action', async () => {
  const out = await runGoal(off, 'Export sub from s7.js too.', [R.strayBase, R.strayEdit]); offRuns.push(out);
  const fb = answerTo(out.reqs, R.strayEdit);
  assert.match(fb, /TOOL RESULT \(edit_file\):\nOK/, `the edit should have applied:\n${String(fb).slice(0, 300)}`);
  assert.doesNotMatch(fb, /DISCARDED/, 'the nudge reports an action that never existed');
  assert.match(readFileSync(join(off.ws, 's7.js'), 'utf8'), /module\.exports = \{ add, sub \}/);
});

await test(`OFF: ${Math.min(30, served.length)} real multi-action replies, one action per turn`, async () => {
  const runs = [];
  for (const [i, chunk] of chunks(served.slice(0, 30), 10).entries()) runs.push(await runGoal(off, GOALS[i % GOALS.length], chunk.map((r) => r.text)));
  offRuns.push(...runs);
  for (const o of [...offRuns]) {
    assert.ok(executed(o.run) <= turns(o.reqs), `run ${o.run.id}: ${executed(o.run)} actions in ${turns(o.reqs)} turns`);
    assert.equal(batchNotes(o.run).length, 0, 'batch bookkeeping ran with the flag OFF');
  }
});

await test('OFF: nothing destroyed (checkInvariants)', () => invariantsClean(off));
stopRig(off);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
