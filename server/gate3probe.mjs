/**
 * GATE 3 PROBE - is the FIND matcher itself broken, or only its error message?
 *
 *   node server/gate3probe.mjs
 *
 * Drives the REAL hub (spawned, scripted mock model) so every case goes through the shipped parse -> edit_file ->
 * exact -> occurrence -> tolerant path and the real write guards. Deliberately NOT a copy of the matcher: a copy
 * would only prove what I believe the matcher does.
 *
 * Each case gets its OWN file, written fresh, so one case cannot contaminate the next. REPLACE always differs from
 * FIND (a MARKER comment is appended) so the no-op refusal cannot fire and be misread as a matching failure.
 *
 * The four cases, against s1_library.js exactly as set J run 8e7cf9aa found it:
 *   A  text copied verbatim out of the file            -> must MATCH (if this fails the matcher is broken outright)
 *   B  the same text re-indented                       -> should match via the tolerant path
 *   C  the exact 3-line prefix the model DID share     -> must MATCH (the model quoted these three lines correctly)
 *   D  the model's real step-[6] FIND (invented body)  -> must REFUSE (matching it would corrupt the file)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);

/** s1_library.js EXACTLY as it stood when 8e7cf9aa outlined it (26 lines). */
const LIB = [
  'class Library {',
  '  constructor() {',
  '    this.books = {};',
  '  }',
  '',
  '  addBook(isbn, title, copies = 1) {',
  "    if (typeof copies !== 'number' || copies <= 0) {",
  "      throw new Error('Copies must be a positive integer');",
  '    }',
  '    if (!this.books[isbn]) {',
  '      this.books[isbn] = { title, copies };',
  '    } else {',
  '      this.books[isbn].copies += copies;',
  '    }',
  '  }',
  '',
  '  copies(isbn) {',
  '    return this.books[isbn] ? this.books[isbn].copies : 0;',
  '  }',
  '',
  '  titles() {',
  '    return Object.values(this.books).map(book => book.title).sort();',
  '  }',
  '}',
  '',
  'module.exports = Library;',
].join('\n');

const EXACT = [
  '  copies(isbn) {',
  '    return this.books[isbn] ? this.books[isbn].copies : 0;',
  '  }',
].join('\n');

const REINDENTED = [
  '    copies(isbn) {',
  '        return this.books[isbn] ? this.books[isbn].copies : 0;',
  '    }',
].join('\n');

const SHARED_PREFIX = [
  '  addBook(isbn, title, copies = 1) {',
  "    if (typeof copies !== 'number' || copies <= 0) {",
  "      throw new Error('Copies must be a positive integer');",
].join('\n');

const MODEL_FIND = [
  '  addBook(isbn, title, copies = 1) {',
  "    if (typeof copies !== 'number' || copies <= 0) {",
  "      throw new Error('Copies must be a positive integer');",
  '    }',
  '    if (!this.books[isbn]) {',
  '      this.books[isbn] = { title: title, copies: copies, onLoan: 0, members: [] };',
  '    }',
  '  }',
].join('\n');

const write = (p, body) => `THOUGHT: w.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const editFind = (p, find, repl) => `THOUGHT: e.\nACTION: edit_file\nPATH: ${p}\nFIND:\n${FENCE}\n${find}\n${FENCE}\nREPLACE:\n${FENCE}\n${repl}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';

const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'g3', lora: null, models: [] }));
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = [];
    try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const text = m.length === 2 ? 'Plan: edit.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'g3', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'gate3-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'g3' } }, history: [], settings: {},
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
for (let i = 0; i < 240 && !up; i++) {
  try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); }
}
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

let surprises = 0;

async function probe(label, name, find, shouldMatch) {
  rig.script = [write(name, LIB), editFind(name, find, find + '\n  // MARKER'), FINISH];
  const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: `Probe ${name}.` }) });
  let run = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    run = await api('/agent/' + st.runId).catch(() => null);
    if (run && TERMINAL.includes(run.status) && run.busy !== true) break;
    await sleep(300);
  }
  const edits = (run?.steps || []).filter((s) => s.type === 'tool' && s.tool === 'edit_file');
  const full = String(edits[0]?.result || '(no edit step reached the tool)');
  const matched = /^OK/.test(full);
  const agrees = matched === shouldMatch;
  if (!agrees) surprises++;
  console.log('  ' + label);
  console.log('      verdict : ' + (matched ? 'MATCHED' : 'refused') + '   expected ' + (shouldMatch ? 'MATCH' : 'refuse')
    + '   ' + (agrees ? '(as expected)' : '*** NOT AS EXPECTED ***'));
  console.log('      answer  : ' + full.split('\n').slice(0, 2).join(' | ').slice(0, 150));
  console.log();
}

console.log('\nGATE 3 - the FIND matcher, driven through the real hub on the real s1_library.js\n');
await probe('A. text copied VERBATIM out of the file', 'a.js', EXACT, true);
await probe('B. the same text, RE-INDENTED (tolerant path)', 'b.js', REINDENTED, true);
await probe('C. the exact 3-line prefix the model DID quote correctly', 'c.js', SHARED_PREFIX, true);
await probe("D. the model's real step-[6] FIND (invented body)", 'd.js', MODEL_FIND, false);

console.log(surprises === 0
  ? '  Gate 3 decided every case the way it should. The defect is the MESSAGE, not the matching.'
  : '  ' + surprises + ' case(s) did NOT behave as expected - gate 3 has a real matching defect.');

hub.kill();
mock.close();
process.exit(0);
