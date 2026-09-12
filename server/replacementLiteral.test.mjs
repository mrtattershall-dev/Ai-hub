/**
 * replacementLiteral.test.mjs - what the model sends as REPLACE is written literally, not interpreted.
 *
 *   node server/replacementLiteral.test.mjs
 *
 * Audited 2026-09-11. edit_file's unique-FIND path is the only one of its four write paths that uses
 * String.prototype.replace:
 *
 *     if (exact === 1) { writeFileSync(full, content.replace(find, replace), 'utf8'); return `OK: edited ${path}.`; }
 *
 * `.replace()` interprets $-patterns in the replacement EVEN when the pattern is a plain string. So a replacement
 * containing $& gets the matched text spliced into it, $' gets the ENTIRE REST OF THE FILE spliced in (duplicating
 * it), and $` gets everything before the match. The LINES path, the OCCURRENCE path and the indentation-tolerant path
 * all use slice/splice and are unaffected - which is what makes this a bug rather than a convention.
 *
 * Why it is silent: the tool answers `OK: edited`, no diff is shown, and for .md/.html/.css/.json there is no syntax
 * check and no definition/export guard to notice. In .js the corruption often breaks parsing and gets caught - so the
 * cases that SURVIVE are exactly the ones nothing looks at.
 *
 * $& is not exotic: regex-escaping code is the canonical instance (`s.replace(/[.*+?]/g, '\\$&')`), and this very
 * repo's source contains that string. A model writing or fixing such code corrupts the file and is told it worked.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const edit = (p, find, repl) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nREPLACE text is written, not interpreted\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'lit', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: write then edit.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'lit', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'lit-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'lit' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
  let run = null; const deadline = Date.now() + 3 * 60000;
  while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
  return (run?.steps || []).filter((s) => s.type === 'tool');
}
const file = (n) => readFileSync(join(dir, 'workspace', n), 'utf8').replace(/\r/g, '');

// Markdown on purpose: no syntax check, no definition guard, nothing downstream that could notice the corruption.
const DOC = ['Line one HOOK here.', 'Line two.', 'Line three.'].join('\n');

const s1 = await runGoal('Change the hook in a.md.', [write('a.md', DOC), edit('a.md', 'HOOK', 'X$&Y'), FINISH]);
await test('the premise: the edit was accepted', () => {
  const r = String(s1.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^OK: edited/, r.slice(0, 160));
});
await test('$& in REPLACE is written literally, not expanded to the matched text', () => {
  assert.ok(file('a.md').includes('X$&Y'), 'got: ' + JSON.stringify(file('a.md').split('\n')[0]));
});

const s2 = await runGoal('Replace a whole line in b.md.', [write('b.md', DOC), edit('b.md', 'Line two.', "KEPT$'"), FINISH]);
await test("$' in REPLACE does not splice the rest of the file back in", () => {
  const body = file('b.md');
  const threes = (body.match(/Line three\./g) || []).length;
  assert.equal(threes, 1, 'the file tail was duplicated ' + threes + ' times:\n' + body);
  assert.ok(body.includes("KEPT$'"), 'the replacement was not written literally: ' + JSON.stringify(body));
});

const s3 = await runGoal('Escape a regex in c.md.', [write('c.md', 'const re = TOKEN;'), edit('c.md', 'TOKEN', "s.replace(/[.*+?]/g, '\\\\$&')"), FINISH]);
await test('the canonical case - regex-escaping code - survives being written', () => {
  assert.ok(file('c.md').includes('$&'), 'the $& in regex-escaping code was eaten: ' + JSON.stringify(file('c.md')));
});

// ── controls: the other paths, and an ordinary replacement ──
const s4 = await runGoal('Ordinary edit of d.md.', [write('d.md', DOC), edit('d.md', 'Line two.', 'Line 2 rewritten.'), FINISH]);
await test('control: an ordinary replacement still edits exactly', () => {
  assert.equal(file('d.md'), DOC.replace('Line two.', 'Line 2 rewritten.'));
});
const s5 = await runGoal('Dollar-one edit of e.md.', [write('e.md', DOC), edit('e.md', 'HOOK', 'cost $1 only'), FINISH]);
await test('control: $1 with no capture group is already literal', () => {
  assert.ok(file('e.md').includes('cost $1 only'), 'got: ' + JSON.stringify(file('e.md').split('\n')[0]));
});

hub.kill(); mock.close();
const KNOWN_EXPECTED = 0;   // no bug here is expected to stay open once the fix lands
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
