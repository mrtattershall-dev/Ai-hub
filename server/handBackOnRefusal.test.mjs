/**
 * handBackOnRefusal.test.mjs - a refused write must hand the model the file, not just a complaint.
 *
 *   node server/handBackOnRefusal.test.mjs
 *
 * tatte, 2026-09-12: "it keeps trying to rewrite instead of taking a file and moving it down the line ... if it
 * fails a scan it needs a manual scan, told why it failed, handed a new copy and try again. It can't get better if
 * it doesn't know why it failed."
 *
 * MEASURED, archive-wide: 619 write/edit/append calls were REFUSED. What the model did before its next write to
 * that same file:
 *       wrote again BLIND, never reading it   314   51%
 *       read the file first                   170   27%
 *       never touched that file again         135   22%
 * 54 runs hit 3+ consecutive refusals on one file (longest 5). Half the time the model retries from imagination,
 * because a refusal hands back a sentence and the file stays unseen.
 *
 * The remedy is already in this codebase and already proven - and wired to the wrong path. The ORIENT substitution
 * injects a file's real contents when a model repeats itself, and its own comment records the measurement:
 * advisory ("you already ran this") 0/5 productive, MECHANICAL (hand it what it needs) 5/5. But ORIENT is
 * list_dir/outline_file/search_file/list_assets/task_list - read-only. Mutating tools were deliberately excluded,
 * so a refused EDIT, the case where the model is most lost, never gets the copy.
 *
 * Traced case (set J coder14b 8e7cf9aa, goal 11): four refusals on s1_library.js, zero read_file calls in the whole
 * run, zero writes landed, and a "Verified (node)" finish. Checker: "threw: l.checkout is not a function".
 *
 * Sizes come from the same records: refused files are 81 lines at the median, 269 at p90, 1842 at most, and a run
 * has 2 refusals at the median and 9 at most - hence a 6000-character cap with an honest truncation note, and a
 * per-run cap of 4.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);

const SRC = [
  'class Shelf {',
  '  constructor() {',
  '    this.items = {};',
  '  }',
  '',
  '  add(id, qty = 1) {',
  '    this.items[id] = (this.items[id] || 0) + qty;',
  '  }',
  '',
  '  count(id) {',
  '    return this.items[id] || 0;',
  '  }',
  '}',
  '',
  'module.exports = Shelf;',
].join('\n');

/** A FIND that is NOT in the file - the model quoting a body it imagined, exactly as 8e7cf9aa did. */
const IMAGINED = [
  '  add(id, qty = 1) {',
  '    this.items[id] = { qty: qty, onLoan: 0, holders: [] };',
  '  }',
].join('\n');

const write = (p, body) => `THOUGHT: w.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const editFind = (p, find, repl) => `THOUGHT: e.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 5).join('\n        ')); }
};

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'hb', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = [];
    try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: edit it.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'hb', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'handback-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'hb' } }, history: [], settings: {},
}), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d)));
hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

/** Run a script and return everything the model was SENT, plus its tool steps. */
async function run(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  let r = null;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    r = await api('/agent/' + st.runId).catch(() => null);
    if (r && TERMINAL.includes(r.status) && r.busy !== true) break;
    await sleep(300);
  }
  const tf = join(dir, 'runs', `${st.runId}.transcript.jsonl`);
  const lines = existsSync(tf) ? readFileSync(tf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const sent = lines.flatMap((l) => (l.sent || []).map((m) => String(m.content || ''))).join('\n---\n');
  return { sent, tools: (r?.steps || []).filter((s) => s.type === 'tool'), notes: (r?.steps || []).filter((s) => s.type === 'note') };
}

console.log('\na refused write hands back the file, so the next attempt is not blind\n');

const refused = await run('Edit shelf.js.', [write('shelf.js', SRC), editFind('shelf.js', IMAGINED, '  // x'), FINISH]);

test('the premise: the edit really was refused and the model really saw the refusal', () => {
  const e = refused.tools.filter((s) => s.tool === 'edit_file');
  assert.equal(e.length, 1, 'exactly one edit_file should have run');
  assert.match(String(e[0].result || ''), /^ERROR: the FIND snippet was not found/, String(e[0].result || '').slice(0, 160));
  assert.match(refused.sent, /ERROR: the FIND snippet was not found/, 'the refusal must reach the model');
});

test('THE FIX: the refusal carries the file as it ACTUALLY reads, with line numbers', () => {
  // DERIVED FROM SRC, never retyped. The first version of this case hard-coded the spacing as "6:" + two spaces
  // and failed against a correct implementation, because the renderer emits "6: " and the line carries its OWN
  // two-space indent - three spaces in all. A hand-written copy of the expected text is one more place to get the
  // file wrong, which is the whole defect this test is about.
  const lines = SRC.split('\n');
  const line6 = `6: ${lines[5]}`;             // "  add(id, qty = 1) {" - the body the imagined FIND got wrong
  const line10 = `10: ${lines[9]}`;           // "  count(id) {"
  assert.ok(refused.sent.includes(line6),
    'the model must be handed the real line 6 verbatim: ' + JSON.stringify(line6));
  assert.ok(refused.sent.includes(line10),
    'and the rest of the file with it: ' + JSON.stringify(line10));
  // The numbering must be the form agentParse.js strips, or a model copying these lines back into a FIND keeps
  // the prefixes and the edit misses again.
  assert.match(refused.sent, /^1: class Shelf \{$/m, 'numbering starts at column 0 as read_file does');
});

test('the hand-back says what it is, and that the model did not call read_file', () => {
  assert.match(refused.sent, /HERE IS shelf\.js AS IT NOW READS/i,
    'it must be labelled, like the ORIENT substitution is - this is not a tool result the model asked for');
});

test('a note records that the hub handed the file over', () => {
  assert.ok(refused.notes.some((n) => /handed .*shelf\.js/i.test(String(n.text || ''))),
    'notes: ' + JSON.stringify(refused.notes.map((n) => n.text)).slice(0, 200));
});

const okRun = await run('Edit shelf.js properly.', [
  write('ok.js', SRC),
  editFind('ok.js', '  count(id) {\n    return this.items[id] || 0;\n  }', '  count(id) {\n    return this.items[id] || 0;\n  }\n\n  total() {\n    return 1;\n  }'),
  FINISH,
]);

test('a SUCCESSFUL edit is not padded with the file (only refusals get the copy)', () => {
  const e = okRun.tools.filter((s) => s.tool === 'edit_file');
  assert.match(String(e[0]?.result || ''), /^OK: edited/, 'precondition: this edit must succeed');
  assert.doesNotMatch(okRun.sent, /HERE IS ok\.js AS IT NOW READS/i,
    'handing the whole file back after every successful edit would bloat the window for nothing');
});

// THE TRUNCATION BRANCH, WHICH NOTHING ABOVE REACHES.
//
// shelf.js is 15 lines, so every case so far ran with cut === 0 and the whole file shown. The truncating path is a
// different piece of code, and the entire hand-back sits inside a try/catch: if that path threw, the catch would
// swallow it, the hand-back would silently not appear, and every test above would still be green. That is the
// failure class this project keeps paying for - a guarded block that fails quietly - so the branch gets driven.
const BIG = ['// a file well past the 6000-character cap', 'class Big {']
  .concat(Array.from({ length: 400 }, (_, i) => `  m${i}() {\n    return ${i};\n  }`))
  .concat(['}', 'module.exports = Big;']).join('\n');

const bigRun = await run('Edit big.js.', [
  write('big.js', BIG),
  editFind('big.js', '  m7() {\n    return SEVEN;\n  }', '  // x'),
  FINISH,
]);

test('a file over the cap is truncated, and the hand-back SAYS it is partial', () => {
  assert.ok(BIG.length > 6000, 'precondition: the fixture must exceed the cap (' + BIG.length + ' chars)');
  assert.match(bigRun.sent, /HERE IS big\.js AS IT NOW READS \(lines 1-\d+ of \d+\)/,
    'a truncated hand-back must say which lines it is showing, not imply it is the whole file');
  assert.match(bigRun.sent, /more line\(s\) below/, 'and say there is more');
  assert.match(bigRun.sent, /you do NOT have the whole file, so do not rewrite it from this/,
    'the honest warning the ORIENT substitution learned the hard way - without it a model rewrites from a beheaded copy');
});

test('the truncated listing is still numbered from line 1, so copied lines keep their real numbers', () => {
  assert.match(bigRun.sent, /^1: \/\/ a file well past the 6000-character cap$/m,
    'numbering must start at 1 and sit at column 0, the form agentParse.js strips');
});

console.log(`\n${passed} passed, ${failed} failed`);
hub.kill();
mock.close();
process.exit(failed ? 1 : 0);
