/**
 * editAddress.test.mjs - an edit can be addressed by LINE NUMBER or by OCCURRENCE, and a directory is a search scope.
 *
 *   node server/editAddress.test.mjs
 *
 * Set E (2026-09-11) measured where long runs actually lose their time: 65 of the two models' edit_file calls failed
 * because the FIND snippet did not match the file - 27 of them "matches N places" - and the usual workaround,
 * rewriting the whole file, is what silently dropped q4_template.js's export. Meanwhile Qwen3-Coder searched the
 * workspace with PATH: . and was told "(no matches for template)" in a workspace holding q4_template.js, because a
 * directory path became the only target and directories are skipped.
 *   LINES: a-b     replaces those lines, no FIND at all; empty REPLACE deletes them; a range outside the file says so
 *   OCCURRENCE: n  picks one of several matching places
 *   search PATH: . searches everything under that directory
 *   controls       a unique FIND still edits; a real whole-file rewrite (no FIND, no LINES) still becomes write_file
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
const editLines = (p, range, repl) => `THOUGHT: editing ${p} by line.\nACTION: edit_file\nPATH: ${p}\nLINES: ${range}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const editFind = (p, find, repl, occ) => `THOUGHT: editing ${p}.\nACTION: edit_file\nPATH: ${p}\n${occ ? `OCCURRENCE: ${occ}\n` : ''}FIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const rewrite = (p, body) => `THOUGHT: rewriting ${p}.\nACTION: edit_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const search = (p, q) => `THOUGHT: searching.\nACTION: search_file\nPATH: ${p}\nQUERY: ${q}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nan edit can be addressed by line or occurrence\n');

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'edit', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: edit the file.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'edit', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'editaddr-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'edit' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '20', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
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
const SRC = ['const a = 1;', 'function one() {', '  return 1;', '}', 'module.exports = { one };'].join('\n');
const TWICE = ['function a() {', '  return 0;', '}', 'function b() {', '  return 0;', '}'].join('\n');

// LINES addressing
const s1 = await runGoal('Edit by line number.', [write('n.js', SRC), editLines('n.js', '2-4', 'function one() {\n  return 2;\n}'), FINISH]);
await test('LINES: a-b replaces those lines, with no FIND at all', () => {
  const r = String(s1.find((s) => s.tool === 'edit_file')?.result || '');
  assert.match(r, /^OK: edited n\.js lines 2-4/, r.slice(0, 200));
  assert.equal(file('n.js'), SRC.replace('  return 1;', '  return 2;'));
});
const s2 = await runGoal('Delete a line.', [write('d.js', SRC), editLines('d.js', '1-1', ''), FINISH]);
await test('an empty REPLACE deletes those lines', () => {
  const r = String(s2.find((s) => s.tool === 'edit_file')?.result || '');
  assert.match(r, /deleted/, r.slice(0, 200));
  assert.equal(file('d.js'), SRC.split('\n').slice(1).join('\n'));
});
const s3 = await runGoal('Edit outside the file.', [write('o.js', SRC), editLines('o.js', '9-12', 'x'), FINISH]);
await test('a range outside the file says how long the file is, and changes nothing', () => {
  const r = String(s3.find((s) => s.tool === 'edit_file')?.result || '');
  assert.match(r, /^ERROR: LINES: 9-12 is outside o\.js, which has 5 lines/, r.slice(0, 200));
  assert.equal(file('o.js'), SRC);
});

// OCCURRENCE addressing
const s4 = await runGoal('Edit the second match.', [write('t.js', TWICE), editFind('t.js', '  return 0;', '  return 9;'), editFind('t.js', '  return 0;', '  return 9;', 2), FINISH]);
await test('an ambiguous FIND still refuses, and now offers OCCURRENCE and LINES', () => {
  const r = String(s4.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /matches 2 places/, r.slice(0, 160));
  assert.match(r, /OCCURRENCE/, r.slice(0, 400));
});
await test('OCCURRENCE: 2 edits the second match', () => {
  const r = String(s4.filter((s) => s.tool === 'edit_file')[1]?.result || '');
  assert.match(r, /^OK: edited t\.js \(occurrence 2 of 2/, r.slice(0, 200));
  assert.equal(file('t.js'), 'function a() {\n  return 0;\n}\nfunction b() {\n  return 9;\n}');
});

// OCCURRENCE on the indentation-tolerant path: this FIND matches nothing exactly (wrong indentation), so only the
// tolerant matcher can see its two places.
// A tab-indented FIND is no exact substring of a space-indented file, so only the tolerant matcher can place it.
const s4b = await runGoal('Edit the second match, badly indented.', [write('u.js', TWICE), editFind('u.js', '\treturn 0;', 'return 7;', 2), FINISH]);
await test('OCCURRENCE also picks the second match when only the tolerant matcher sees it', () => {
  const r = String(s4b.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  assert.match(r, /^OK: edited u\.js \(occurrence 2 of 2, matched ignoring indentation\)/, r.slice(0, 200));
  // WAS 'function b() {\nreturn 7;\n}' - return 7; at COLUMN 0, inside a function body. That expectation had written
  // the defect down as a requirement: a tolerant match ignores indentation on the way IN, and the splice then carried
  // the caller's own indentation into the file. Set I (2026-09-12) goal 3 lost a goal to it - the splice lifted
  // shape() out of its class and the destructive-write guard correctly refused a CORRECT edit. The contract now is
  // that a replacement is re-indented TO the region it replaced, so a REPLACE sent at column 0 against a 2-space
  // body lands at 2 spaces.
  assert.equal(file('u.js'), 'function a() {\n  return 0;\n}\nfunction b() {\n  return 7;\n}');
});

// search_file scope
const s5 = await runGoal('Search everything.', [write('w.js', 'const template = 1;'), search('.', 'template'), FINISH]);
await test('search_file with PATH: . searches every file under it', () => {
  const r = String(s5.find((s) => s.tool === 'search_file')?.result || '');
  assert.doesNotMatch(r, /no matches/, r.slice(0, 200));
  assert.match(r, /w\.js:1/, r.slice(0, 200));
});

// controls
// The rewrite body keeps every name c.js already had: this control is about the PARSER turning a bodied edit_file
// into write_file, and a body that dropped `one` would now (rightly) be refused as destructive.
const REWRITTEN = SRC.replace('  return 1;', '  return 2;');
const s6 = await runGoal('Normal edit and rewrite.', [write('c.js', SRC), editFind('c.js', '  return 1;', '  return 3;'), rewrite('c.js', REWRITTEN), FINISH]);
await test('a unique FIND still edits as before', () => {
  const r = String(s6.filter((s) => s.tool === 'edit_file')[0]?.result || '');
  // Was /^OK: edited c\.js\.?$/ - `$`-anchored with no `m` flag, so it asserted the answer said NOTHING about the
  // file. That is the set G bug written down as a requirement (POST-SETG item 0-A): the answer now carries the
  // resulting line count, and this edit replaces one line with one line, so the count is unchanged.
  assert.match(r, /^OK: edited c\.js; now 5 lines \(same count\)\./, r.slice(0, 200));
});
await test('a whole-file rewrite with no FIND and no LINES still becomes write_file', () => {
  const w = s6.filter((s) => s.tool === 'write_file');
  assert.equal(w.length, 2, 'write_file calls: ' + w.length);
  assert.equal(file('c.js'), REWRITTEN);
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
