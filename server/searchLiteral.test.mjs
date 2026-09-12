/**
 * searchLiteral.test.mjs - search_file must find the text the model asked for.
 *
 *   node server/searchLiteral.test.mjs
 *
 * Audited 2026-09-11:
 *
 *     try { re = new RegExp(query, 'i'); }
 *     catch { re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
 *
 * The escaped fallback only runs when the query is an INVALID regex. A query that is valid regex but means something
 * different as regex compiles happily and silently fails to match text that is plainly in the file:
 *
 *     arr[0]      -> /arr[0]/i      needs "arr0"           ... misses `const x = arr[0];`
 *     sum(a, b)   -> /sum(a, b)/i   a capture group        ... misses `const t = sum(a, b);`
 *     a+b         -> /a+b/i         one-or-more 'a'        ... misses `const z = a+b;`
 *     cfg.mode    -> /cfg.mode/i    '.' is any character   ... ALSO matches cfg_mode, cfgXmode
 *
 * Why it matters more than a missing feature: this is an ORIENTATION tool, and the answer is a confident
 * "(no matches for ...)". A false negative is the documented route from "the code isn't there" to a whole-file
 * rewrite, which is the shape that destroyed a third of Qwen3-Coder's working code in set F. The same symptom - a
 * confident empty answer - was already fixed once here for a different cause (a directory path becoming the only
 * target), so it is worth being explicit that this is the OTHER cause of it, still live.
 *
 * Indexing and call expressions are exactly what a coder searches for, so this is not an exotic query shape.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const search = (p, q) => `THOUGHT: looking for it.\nACTION: search_file\nPATH: ${p}\nQUERY: ${q}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nsearch_file finds what was asked for\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'srch', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: search.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'srch', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'srch-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
// Ordinary code: an index, a call, a sum, and a property access.
writeFileSync(join(ws, 'code.js'), [
  'const first = arr[0];',
  'const total = sum(a, b);',
  'const z = a+b;',
  'if (cfg.mode) { run(); }',
  'const other = cfg_mode;',
  'function clickHandler(e) { return e; }',
  'function keyHandler(e) { return e; }',
].join('\n'), 'utf8');

writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'srch' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }
// One run, several searches: each result is read back off the step list by order.
rig.script = [
  search('code.js', 'arr[0]'), search('code.js', 'sum(a, b)'), search('code.js', 'a+b'),
  search('code.js', 'cfg.mode'), search('code.js', 'total'),
  // A query that can ONLY work as a pattern. Without this, the literal-first half of the fix is pinned and the
  // pattern-FALLBACK half is not: disabling the fallback would leave every other case passing. Found by writing the
  // mutant for it and seeing it would escape - the same overlap that let the repeat-key fix go unpinned earlier.
  search('code.js', 'function \\w+Handler'),
  FINISH,
];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Find things in code.js.' }) });
let run = null; const deadline = Date.now() + 4 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
const results = (run?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'search_file').map((s) => String(s.result || ''));

await test('the premise: all six searches reached the tool', () => {
  assert.equal(results.length, 6, 'search_file results: ' + results.length + ' / status ' + run?.status);
});
await test('an indexing expression is found', () => {
  assert.doesNotMatch(results[0], /no matches/, 'arr[0] is on line 1: ' + results[0].slice(0, 160));
});
await test('a call with arguments is found', () => {
  assert.doesNotMatch(results[1], /no matches/, 'sum(a, b) is on line 2: ' + results[1].slice(0, 160));
});
await test('a plus expression is found', () => {
  assert.doesNotMatch(results[2], /no matches/, 'a+b is on line 3: ' + results[2].slice(0, 160));
});
await test('a dotted name does not also match an underscored one', () => {
  // cfg.mode is real, cfg_mode is a different identifier. As a regex the '.' matches the underscore too.
  assert.doesNotMatch(results[3], /no matches/, 'cfg.mode is on line 4: ' + results[3].slice(0, 160));
  assert.doesNotMatch(results[3], /cfg_mode/, 'matched cfg_mode, a different identifier: ' + results[3].slice(0, 200));
});
await test('a query that only works as a pattern still works, and says so', () => {
  // The one case that pins the FALLBACK half of the fix: as literal text this matches nothing, so it can only be
  // answered by re-reading the query as a pattern. Both handler functions must come back.
  assert.doesNotMatch(results[5], /no matches/, 'the pattern fallback did not run: ' + results[5].slice(0, 200));
  assert.match(results[5], /clickHandler/, results[5].slice(0, 200));
  assert.match(results[5], /keyHandler/, results[5].slice(0, 200));
  assert.match(results[5], /read as a pattern/, 'the answer does not say which reading found it: ' + results[5].slice(0, 200));
});
await test('control: a plain word still searches as before', () => {
  assert.doesNotMatch(results[4], /no matches/, results[4].slice(0, 160));
  assert.match(results[4], /code\.js:2/, results[4].slice(0, 160));
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;
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
