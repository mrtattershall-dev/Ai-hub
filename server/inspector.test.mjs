/**
 * inspector.test.mjs - the Inspector's gates, each shown able to pass AND to stop a finding.
 *
 *   node server/inspector.test.mjs        (needs Docker and the legasus-worker:1 image; spends nothing)
 *
 * A throwaway git repo holds server/add.js, which subtracts. A mock API (streamed, like the real one)
 * returns four findings, and each must end exactly where the change process says it should:
 *   real          test fails on the bug, fix in scope          -> COMMITTED on watchers/<id>
 *   not-a-bug     test already passes                          -> stopped at RED (not reproduced)
 *   broken-test   test dies on a missing import                -> stopped at RED (fails for its own reasons)
 *   out-of-scope  real failing test, fix edits a file not granted -> stopped at FIX by governedEdit
 */
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const T = mkdtempSync(join(tmpdir(), 'inspector-test-'));
const repo = join(T, 'repo');
mkdirSync(join(repo, 'server'), { recursive: true });
const g = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
writeFileSync(join(repo, 'server', 'add.js'), 'export const add = (a, b) => a - b;\n');
writeFileSync(join(repo, 'server', 'other.js'), 'export const x = 1;\n');
g('init', '-q'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
writeFileSync(join(T, 'hub.json'), JSON.stringify({ api_keys: { claude: { key_value: 'sk-test' } } }));

const FAILS_ON_BUG = "import assert from 'node:assert/strict';\nimport { add } from './add.js';\nassert.equal(add(2, 3), 5);\n";
const finding = (slug, test_code, edits) => ({ slug, title: slug, file: 'server/add.js', line: 1, severity: 'high', mechanism: 'm', trigger: 't', evidence: 'e', confidence: 'high', test_code, fix_summary: 'f', edits });
const answer = { notes: 'four controls', findings: [
  finding('real', FAILS_ON_BUG, [{ file: 'server/add.js', old: 'a - b', new: 'a + b' }]),
  finding('not-a-bug', "import assert from 'node:assert/strict';\nimport { add } from './add.js';\nassert.equal(typeof add, 'function');\n", []),
  finding('broken-test', "import { nope } from './missing.js';\nnope();\n", []),
  finding('out-of-scope', FAILS_ON_BUG, [{ file: 'server/other.js', old: 'x = 1', new: 'x = 2' }]),
] };

let calls = 0;
const sse = (res, events) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); for (const [ev, data] of events) res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); res.end(); };
const server = createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    calls += 1;
    const b = JSON.parse(body);
    assert.equal(b.stream, true, 'the diagnosis streams');
    assert.match(b.messages[0].content, /SCOPE \(the only writable files\): server\/add\.js/);
    const text = JSON.stringify(answer);
    sse(res, [
      ['message_start', { type: 'message_start', message: { id: 'm1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, usage: { input_tokens: 5000, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3000 } }],
      ['message_stop', { type: 'message_stop' }],
    ]);
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

const env = { ...process.env, INSPECT_REPO: repo, INSPECT_OUT: join(T, 'out'), WATCHERS_DIR: join(T, 'enoch'), HUB_DB: join(T, 'hub.json'),
  WATCHERS_BASE_URL: `http://127.0.0.1:${server.address().port}`, WATCHERS_BUDGET_USD: '10', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
// Async, not spawnSync: the mock API lives in THIS process, and a blocked event loop never answers it.
const r = await new Promise((ok) => {
  const c = spawn(process.execPath, [join(HERE, 'inspector.mjs'), '--files', 'server/add.js', '--max', '5'], { env });
  let stdout = '', stderr = '';
  c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stderr += d; });
  const kill = setTimeout(() => c.kill(), 20 * 60_000);
  c.on('close', (code) => { clearTimeout(kill); ok({ code, stdout, stderr }); });
});
server.close();
process.stdout.write(r.stdout + r.stderr);
assert.equal(calls, 1, 'one diagnosis call');

const rows = readFileSync(join(T, 'enoch', 'enoch.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const end = (slug) => rows.filter((x) => x.finding?.endsWith(`-${slug}`)).at(-1);
assert.ok(rows.find((x) => x.gate === 'freeze' && x.revisions['server/add.js']), 'FREEZE recorded the pinned revision before the call');
assert.equal(rows.find((x) => x.gate === 'diagnose').costUsd, 0.04, '5k in x $2 + 3k out x $10 per MTok');

assert.equal(end('real').gate, 'commit'); assert.equal(end('real').passed, true);
assert.equal(rows.find((x) => x.finding?.endsWith('-real') && x.gate === 'stress').consecutive, 10, 'perfect over ten');
const branch = end('real').branch;
assert.equal(g('show', `${branch}:server/add.js`), 'export const add = (a, b) => a + b;', 'the fix is on the branch');
assert.equal(readFileSync(join(repo, 'server', 'add.js'), 'utf8'), 'export const add = (a, b) => a - b;\n', 'the checked-out tree is untouched');
assert.match(g('log', '-1', '--format=%B', branch), /STRESS 10\/10/);

assert.equal(end('not-a-bug').gate, 'red'); assert.match(end('not-a-bug').why, /not reproduced/);
assert.equal(end('broken-test').gate, 'red'); assert.match(end('broken-test').why, /its own reasons/);
assert.equal(end('out-of-scope').gate, 'fix'); assert.match(end('out-of-scope').why, /ACTION_DENIED_SCOPE_MISMATCH/, 'refused by governedEdit');
assert.deepEqual(g('branch', '--list', 'watchers/*').split('\n').map((s) => s.trim()), [branch], 'only the committed finding keeps a branch');

console.log('\ninspector: all gates behave - commit, not-reproduced, broken-test and out-of-scope each end where they must');
