/**
 * tolerantIndent.test.mjs - the whitespace-tolerant edit must not move code out of its block.
 *
 *   node server/tolerantIndent.test.mjs
 *
 * FOUND LIVE, set I (2026-09-12), goal 3, dense Qwen2.5-Coder-32B. The model wrote a skeleton:
 *
 *     class Matrix {
 *       shape() {
 *         // Shape logic will go here
 *       }
 *     }
 *
 * and sent a correct edit to fill the stub in, with its FIND/REPLACE at 2-space body indent against the file's
 * 4-space. The exact matcher missed (indentation differs), so the TOLERANT path took it - and spliced REPLACE in
 * VERBATIM at the model's own indentation, lifting `shape()` out of the class body. The destructive-write guard then
 * correctly refused the write: `would have REMOVED ... shape`. The model tried inserting the method instead and hit
 * the OTHER guard, `would have DUPLICATED ... shape (1 -> 2)`. Four identical retries later the loop guard ended the
 * run. THE GOAL WAS LOST - and the weaker MoE 30B scored that same goal impl=Y.
 *
 * Proven pure-module before this test was written (defNames/lostDefs, path argument supplied):
 *     names before              [Matrix, shape]
 *     after the INTENDED edit   [Matrix, shape]   lost: []        <- guard would not fire
 *     after the TOLERANT splice [Matrix]          lost: [shape]   <- guard fires, CORRECTLY
 *
 * So the guard is the messenger. The defect is upstream, at agent.js:764 and :771:
 *     [...fileLines.slice(0, start), replace, ...fileLines.slice(end + 1)]
 * `replace` goes in as ONE array element carrying the model's indentation, and scanTolerant (agent.js:745) matches on
 * `hay[fi].trim()` so it never captures the matched region's leading whitespace to re-indent against.
 *
 * THE CONTRACT: an edit matched "ignoring indentation" must be re-indented TO the region it replaced, so tolerance
 * about the input never becomes damage to the output.
 *
 * FIXED 2026-09-12 by reindentTo(), anchored on regionAnchor() - the first NON-BLANK line of the matched
 * region, because scanTolerant skips blanks while matching but still anchors the region at i, so `start` can
 * land on a blank line. The first version of the fix read indentation from that blank line, got "", and was a
 * silent no-op: it parsed, ran on both paths, and changed nothing. All five cases now pass.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';
import { defNames } from './defNames.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const edit = (p, find, replace) =>
  `THOUGHT: filling the stub in.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${replace}\n${FENCE}`;
const finishN = (n) => `THOUGHT: that is the change I wanted (${n}).\nACTION: finish\nSUMMARY: done, pass ${n}`;

let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\na tolerant edit re-indents to the region it replaced\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'ti', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write it.' : (rig.script.length ? rig.script.shift() : finishN('last'));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'ti', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'tindent-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'ti' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '8', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }
async function runGoal(goal, script) {
  rig.script = [...script];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
  assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
  let run = null; const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return run;
}
const file = (n) => readFileSync(join(ws, n), 'utf8').replace(/\r/g, '');
const results = (run) => (run?.steps || []).filter((s) => s.type === 'tool').map((s) => String(s.result || ''));

// The live shape: a class whose members are indented 4, edited with a snippet indented 2.
const SKELETON = [
  'class Matrix {',
  '    constructor(rows) {',
  '        this.rows = rows;',
  '    }',
  '',
  '    shape() {',
  '        // Shape logic will go here',
  '    }',
  '}',
  '',
  'module.exports = Matrix;',
].join('\n');
const FIND = ['shape() {', '  // Shape logic will go here', '}'].join('\n');
const REPLACE = ['shape() {', '  return [this.rows.length, this.rows[0].length];', '}'].join('\n');
const MJS = 'm.js';
const VACUOUS_MSG = 'VACUOUS: the edit never landed - m.js is still the untouched skeleton, so this assertion would pass with or without the re-indent fix. It is blocked by the destructive-write refusal, not satisfied by correct behaviour.';

const run = await runGoal('Fill in the shape() stub in m.js.', [write('m.js', SKELETON), edit('m.js', FIND, REPLACE), finishN(1)]);

await test('the premise: the tolerant path handled the edit (the exact matcher could not)', () => {
  const tolerant = results(run).some((r) => /matched ignoring indentation/.test(r));
  const refused = results(run).some((r) => /would have REMOVED/.test(r));
  assert.ok(tolerant || refused,
    'neither a tolerant edit nor a destructive refusal happened, so this fixture is not exercising the path:\n' + results(run).join('\n').slice(0, 300));
});

await test('the edit is accepted, not refused as destructive', () => {
  const refused = results(run).filter((r) => /would have REMOVED/.test(r));
  assert.equal(refused.length, 0,
    'the tolerant splice de-indented shape() out of the class, so the destructive-write guard refused a CORRECT edit:\n'
    + refused[0]?.slice(0, 200));
});

await test('shape() is still a member of the class afterwards', () => {
  assert.ok(file(MJS) !== SKELETON, VACUOUS_MSG);
  const names = [...defNames(file('m.js'), 'm.js')];
  assert.ok(names.includes('shape'),
    'shape() is no longer found as a definition - the tolerant splice moved it out of the class body.\n'
    + 'file now:\n' + file('m.js'));
});

await test('the replacement is indented to the region it replaced, not to the model\'s snippet', () => {
  assert.ok(file(MJS) !== SKELETON, VACUOUS_MSG);
  const line = file('m.js').split('\n').find((l) => /shape\(\)\s*\{/.test(l));
  assert.ok(line !== undefined, 'shape() line is gone entirely:\n' + file('m.js'));
  const indent = (line.match(/^(\s*)/) || [])[1] ?? '';
  assert.equal(indent.length, 4,
    `shape() is indented ${indent.length}, expected 4 to match the class members it replaced. Line: ${JSON.stringify(line)}`);
});

await test('the file still parses (the whole point of not moving code between blocks)', () => {
  const src = file('m.js');
  const opens = (src.match(/\{/g) || []).length, closes = (src.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'braces are unbalanced after the edit:\n' + src);
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;   // FIXED 2026-09-12: reindentTo() + regionAnchor(), called from both tolerant splice sites
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
