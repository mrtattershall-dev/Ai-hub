/**
 * mockLoop.test.mjs - drive the WHOLE loop with real recorded model output, offline.
 *
 *   node server/mockLoop.test.mjs
 *
 * parserCorpus.test.mjs proves the parser survives 1,759 real responses. This proves the
 * rest of the machine does: tool dispatch, checkpoints, the boundary-marker guard, the
 * syntax rollback, the ledger, escalation - driven by a model that says what real models
 * said, on a free local port with no GPU.
 *
 * WHAT IT ASSERTS, AND WHY IT IS NOT A SCORE. The mock REPLAYS; it cannot react to what the
 * hub says back. If the hub returns an error the next reply is still whatever came next in
 * the recording, so "did the goal get done" is meaningless here and is deliberately not
 * measured. What IS meaningful is that nothing gets destroyed. Both of today's worst bugs
 * were destruction, not failure:
 *
 *   - the boundary marker overwritten with {"type":"module"}  (9 of 67 workspaces)
 *   - code left on disk that will not parse                   (10 of 67 workspaces)
 *
 * Neither needed a GPU to detect. Both went unnoticed for hours because nothing looked.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 400)}`); }
};

console.log('\nfull loop vs. recorded model output (offline)\n');
if (!existsSync(CORPUS)) { console.error('  SKIP  no corpus'); process.exit(0); }

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
// Prefer responses that DO something - a run of pure planner prose exercises nothing.
const acting = rows.filter((r) => r.actions.length > 0);

// THE ATTACKS, SERVED DELIBERATELY.
//
// The first version of this test cycled the corpus generically and passed WITH THE MARKER
// GUARD DISABLED - it never actually attempted the attack, so the invariant below was
// decoration. Only the FIRST action of a response is executed, so an attack is a response
// whose first action writes package.json. There are 20 of those; they go first.
const firstAction = (t) => (t.match(/ACTION:\s*([a-z_]+)/i) || [])[1] || '';
const firstPath = (t) => ((t.match(/PATH:\s*(.+)/i) || [])[1] || '').trim();
const markerAttacks = acting.filter((r) =>
  /^(write_file|edit_file|append_file)$/i.test(firstAction(r.text)) && /package\.json/i.test(firstPath(r.text)));
// ONE SYNTHETIC RESPONSE, and it is worth explaining why the corpus alone is not enough.
//
// 92 recorded write_file responses target a .js file and ALL 92 produce code that parses -
// the model does not write syntactically broken files in one shot. The 10 broken files found
// in the workspace audit came from EDITS splicing a file into an invalid state, which
// depends on what that file already contained and so cannot be reproduced by replay.
//
// Verified the gap rather than assumed it: with the rollback disabled and the marker guard
// intact, this test still passed - the broken-code invariant was only ever firing as a side
// effect of marker destruction, never on its own. A deterministic trigger is the only way to
// exercise it, so this is a fabricated reply, marked as such, and the ONLY one here.
// It takes TWO responses, and finding that out was the point of writing them.
//
// A single broken write is NOT the real failure and is not recoverable: `git show HEAD:file`
// returns null for a file that never existed, so there is no earlier version to restore and
// the rollback correctly does nothing. The first version of this probe wrote one broken file
// and "failed" the test against working code.
//
// The 10 broken files in the workspace audit were all EDITS to files that already parsed.
// So: write it good (which checkpoints it), then break it. Now HEAD holds a version worth
// going back to, which is exactly the situation the rollback exists for.
const SYNTHETIC_GOOD_WRITE = {
  goal: '(synthetic)',
  actions: ['write_file'],
  text: 'THOUGHT: writing the module.\nACTION: write_file\nPATH: broken_probe.js\n```javascript\nfunction add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n```',
};
const SYNTHETIC_BROKEN_WRITE = {
  goal: '(synthetic)',
  actions: ['write_file'],
  text: 'THOUGHT: adjusting it.\nACTION: write_file\nPATH: broken_probe.js\n```javascript\nfunction add(a, b) {\n  return a + b;\n}\n};\nmodule.exports = { add };\n```',
};
const replayOrder = [...markerAttacks, SYNTHETIC_GOOD_WRITE, SYNTHETIC_BROKEN_WRITE, ...acting];
console.log(`  corpus: ${rows.length} responses (${acting.length} act, ${markerAttacks.length} attack the boundary marker)\n`);

const [mockPort, hubPort] = await freePorts(2);

// ── the mock model ───────────────────────────────────────────────────────────
// Ollama shape, because that is what the hub already speaks. Serves recorded replies in
// order, cycling, so the run is deterministic across machines.
let served = 0;
const mock = createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'corpus', lora: null }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const text = replayOrder[served++ % replayOrder.length].text;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'corpus', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

// ── an isolated hub pointed at it ────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'mockloop-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'corpus' } }, history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '3',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));

const API = `http://127.0.0.1:${hubPort}/api`;
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
let up = false;
for (let i = 0; i < 240; i++) {
  try { await fetch(API + '/auth/hint'); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

const GOALS = [
  'Create p1_calc.js exporting add(a,b) and mul(a,b), with self-checks that throw. Verify with node.',
  'Add sub(a,b) to the EXISTING p1_calc.js, keeping add and mul unchanged. Verify.',
  'Write P1.md documenting every function that really exists in p1_calc.js. Read the file first.',
];

await test('the hub starts against a mock model', () => {
  assert.ok(up, 'hub never came up:\n' + hubLog.join('').slice(-500));
});

await test('the loop runs real recorded output end to end without crashing', async () => {
  for (const goal of GOALS) {
    const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 160));
    const deadline = Date.now() + 4 * 60000;
    let run = null;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      // Terminal is not finished: the run keeps the workspace (busy) until its teardown - the
      // syntax rollback - is done, so starting the next goal on status alone is refused.
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'].includes(run.status) && !run.busy) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(run, 'run never reached a terminal state');
  }
  assert.ok(served > 0, 'the mock was never called - the hub was not actually talking to it');
  console.log(`        ${served} recorded responses replayed through the loop`);
});

await test('the hub process is still alive afterwards', () => {
  assert.equal(hub.exitCode, null, 'the hub died during the run:\n' + hubLog.join('').slice(-600));
});

// ── the invariants that actually caught today's worst bugs ───────────────────
// A passing invariant proves nothing if the attack was never attempted. The corpus holds 32
// recorded responses that try to write or edit package.json - if a future corpus loses them,
// or the replay order stops reaching them, the marker test below would go green by doing
// nothing. Fail loudly instead.
await test('COVERAGE: the run actually attempted the attacks the invariants defend against', () => {
  // Counted PER RESPONSE, not across the concatenated transcript. The loose version of this
  // check passed WHILE THE GUARD WAS DISABLED, because "package.json appears somewhere" and
  // "a write appears somewhere" were true of different replies. Only the FIRST action of a
  // response is executed, so only that one counts as an attempt.
  const replayed = replayOrder.slice(0, served);
  const markerTries = replayed.filter((r) =>
    /^(write_file|edit_file|append_file)$/i.test(firstAction(r.text)) && /package\.json/i.test(firstPath(r.text))).length;
  const writeTries = replayed.filter((r) => /^(write_file|append_file|edit_file)$/i.test(firstAction(r.text))).length;
  console.log(`        replayed ${served}: ${writeTries} write attempts, ${markerTries} of them at the boundary marker`);
  assert.ok(writeTries > 0, 'no write was attempted - every invariant below would pass vacuously');
  assert.ok(markerTries > 0, 'no package.json write was attempted - the marker invariant proves nothing this run');
});

await test('INVARIANT: the workspace boundary marker survives', () => {
  const p = join(ws, 'package.json');
  if (!existsSync(p)) return;                    // no marker written yet is fine
  const raw = readFileSync(p, 'utf8');
  let j; try { j = JSON.parse(raw); } catch { assert.fail(`package.json is no longer valid JSON (${raw.length}B)`); }
  assert.equal(j.type, 'commonjs', `module system changed to "${j.type}" - the prompt tells the model this workspace is commonjs`);
  assert.ok(raw.length > 100, `marker shrank to ${raw.length}B - it was overwritten, not edited`);
});

await test('INVARIANT: no unparseable code is left behind', () => {
  const bad = [];
  for (const f of readdirSync(ws).filter((x) => /\.(c|m)?js$/i.test(x))) {
    try { execFileSync(process.execPath, ['--check', join(ws, f)], { timeout: 20000, stdio: 'pipe' }); }
    catch { bad.push(f); }
  }
  assert.equal(bad.length, 0, `left broken code on disk: ${bad.join(', ')} — the syntax rollback should have restored these`);
});

await test('INVARIANT: nothing was written outside the workspace', () => {
  const stray = readdirSync(dir).filter((f) => !['workspace', 'hub.json', 'queue.json', 'runs', 'index.jsonl'].includes(f));
  assert.equal(stray.length, 0, `files appeared beside the workspace: ${stray.join(', ')}`);
});

hub.kill();
mock.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
