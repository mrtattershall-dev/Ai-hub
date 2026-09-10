/**
 * fuzzInvariants.test.mjs - does each fuzz check actually FIRE?
 *
 *   node server/fuzzInvariants.test.mjs
 *
 * fuzzLoop.mjs reporting "40/40 clean" is only worth anything if every check it runs is
 * known to go red on the damage it names. The first version of mockLoop's marker check passed
 * with the marker guard switched off, because the attack never reached the tool. So: build
 * one deliberately corrupted run directory per violation kind, and assert that kind - and
 * ONLY that kind - is reported. Plus one clean directory that must report nothing, so the
 * checker cannot pass by flagging everything.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkInvariants, checkQueueInvariants } from './fuzzInvariants.mjs';
import { hostileCategories } from './fuzzCorpus.mjs';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const GOOD_MARKER = JSON.stringify({
  name: 'agent-workspace', version: '0.0.0', private: true, type: 'commonjs',
  description: 'Boundary marker. Stops npm/node/tsc walking up into the hub project.',
}, null, 2);

// A healthy run directory: marker intact, code that parses, valid run and index files.
function healthy() {
  const dir = mkdtempSync(join(tmpdir(), 'inv-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  mkdirSync(join(dir, 'runs'), { recursive: true });
  writeFileSync(join(ws, 'package.json'), GOOD_MARKER, 'utf8');
  writeFileSync(join(ws, 'ok.js'), 'function add(a, b) { return a + b; }\nmodule.exports = { add };\n', 'utf8');
  writeFileSync(join(dir, 'hub.json'), '{}', 'utf8');
  writeFileSync(join(dir, 'runs', 'r1.json'), JSON.stringify({ id: 'r1', status: 'done' }), 'utf8');
  writeFileSync(join(dir, 'index.jsonl'), JSON.stringify({ id: 'r1' }) + '\n', 'utf8');
  return { dir, ws };
}
const kinds = (v) => [...new Set(v.map((x) => x.split(':')[0]))].sort();

console.log('\nfuzz invariants\n');

test('a healthy run directory reports NOTHING', () => {
  // Without this, a checker that flags everything would pass every test below.
  const { dir } = healthy();
  const v = checkInvariants(dir);
  assert.deepEqual(v, [], `clean directory flagged: ${v.join(' | ')}`);
});

test('CRASH fires when the hub exited', () => {
  const { dir } = healthy();
  assert.deepEqual(kinds(checkInvariants(dir, { hubExitCode: 1, hubLog: 'TypeError: boom' })), ['CRASH']);
});

test('a hub still running (exitCode null) is NOT a crash', () => {
  const { dir } = healthy();
  assert.deepEqual(checkInvariants(dir, { hubExitCode: null }), []);
});

test('an invalid-JSON marker breaks EVERY .js file, not just itself', () => {
  // This test first expected ['MARKER'] alone and got ['BROKEN', 'MARKER'] - and the checker
  // was right. `node --check` reads the nearest package.json to decide the module type, so
  // when the marker is not valid JSON, node refuses every .js file in the workspace, including
  // ok.js, which is perfectly valid code. A destroyed marker does not damage one file; it
  // takes the whole workspace down with it. That is why it mattered that 9 of 67 real
  // workspaces had one, and why the guard refuses writes to it outright.
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'package.json'), '{"type":"module"', 'utf8');   // truncated, as seen
  assert.deepEqual(kinds(checkInvariants(dir)), ['BROKEN', 'MARKER']);
});

test('MARKER fires on the 22-byte {"type":"module"} stub', () => {
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'package.json'), '{"type":"module"}', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['MARKER']);
});

test('BROKEN fires on code that does not parse', () => {
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'bad.js'), 'function add(a, b) {\n  return a + b;\n}\n};\n', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['BROKEN']);
});

test('ESM code in a commonjs workspace is ESM, NOT broken', () => {
  // Valid code, wrong module system. Lumping it in with unparseable code made the fuzz report
  // look like the rollback was failing when the file was never broken at all.
  const { dir, ws } = healthy();
  writeFileSync(join(ws, 'esm.js'), "import { add } from './ok.js';\nconsole.log(add(1, 2));\n", 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['ESM']);
});

test('STRAY fires on a file written beside the workspace', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'index.html'), '<h1>landed in the wrong place</h1>', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['STRAY']);
});

test('the harness\'s own .bak/.tmp files are NOT strays', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'hub.json.bak'), '{}', 'utf8');
  writeFileSync(join(dir, 'queue.json.tmp'), '[]', 'utf8');
  assert.deepEqual(checkInvariants(dir), []);
});

test('GIT fires when the workspace .git is not a usable repo of its own', () => {
  // Honest scope: this exercises the "cannot resolve" branch. Reproducing the original bug -
  // a workspace resolving to an ENCLOSING repo - needs the hub's own checkout around it,
  // which a temp dir cannot fake without escaping the ceiling the check itself sets.
  const { dir, ws } = healthy();
  mkdirSync(join(ws, '.git'), { recursive: true });                      // empty = not a repo
  assert.deepEqual(kinds(checkInvariants(dir)), ['GIT']);
});

test('RUNFILE fires on a truncated persisted run', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'runs', 'r2.json'), '{"id":"r2","status":"do', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['RUNFILE']);
});

test('INDEX fires on a run-index line that no longer parses', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'index.jsonl'), JSON.stringify({ id: 'r1' }) + '\n{"id":"r2",\n', 'utf8');
  assert.deepEqual(kinds(checkInvariants(dir)), ['INDEX']);
});

// ── queue invariants (fuzzLoop --mode=chain) ────────────────────────────────────────────
// Same standard: each kind fires on the damage it names, and ONLY that kind; a healthy
// settled chain reports nothing; and the states the hub legitimately leaves are NOT flagged.
console.log('\nqueue invariants\n');

const item = (id, status, after = null, extra = {}) => ({ id, goal: `step ${id}`, after, status, priority: 0, generation: 0, createdAt: 1, ...extra });
function withQueue(items, runs = []) {
  const { dir } = healthy();
  writeFileSync(join(dir, 'queue.json'), JSON.stringify({ items }, null, 2), 'utf8');
  for (const r of runs) writeFileSync(join(dir, 'runs', `${r.id}.json`), JSON.stringify(r), 'utf8');
  return dir;
}
const qkinds = (dir) => kinds(checkQueueInvariants(dir));

test('a healthy chain mid-flight reports NOTHING (from either checker)', () => {
  // done -> done -> taken by a live run -> queued behind it. Every status here is normal.
  const dir = withQueue(
    [item('a', 'done'), item('b', 'done', 'a'), item('c', 'taken', 'b'), item('d', 'queued', 'c')],
    [{ id: 'rc', queueItemId: 'c', status: 'running' }],
  );
  assert.deepEqual(checkQueueInvariants(dir), []);
  assert.deepEqual(checkInvariants(dir), [], 'queue.json is a harness file, never a stray');
});

test('no queue.json at all (default mode) reports nothing', () => {
  const { dir } = healthy();
  assert.deepEqual(checkQueueInvariants(dir), []);
});

test('STRANDED fires on a queued step behind a STOPPED predecessor (the known hub bug)', () => {
  const dir = withQueue([item('a', 'stopped'), item('b', 'queued', 'a')], [{ id: 'ra', queueItemId: 'a', status: 'stopped' }]);
  assert.deepEqual(qkinds(dir), ['STRANDED']);
});

test('STRANDED fires behind a FAILED and behind an ERROR predecessor', () => {
  assert.deepEqual(qkinds(withQueue([item('a', 'failed'), item('b', 'queued', 'a')])), ['STRANDED']);
  assert.deepEqual(qkinds(withQueue([item('a', 'error'), item('b', 'queued', 'a')])), ['STRANDED']);
});

test('STRANDED fires when the predecessor no longer exists', () => {
  assert.deepEqual(qkinds(withQueue([item('b', 'queued', 'gone')])), ['STRANDED']);
});

test('a step behind a queued, taken, done or INTERRUPTED predecessor is NOT stranded', () => {
  // interrupted is resumable by design - the supervisor tick resumes it - so it is not dead.
  for (const s of ['queued', 'done', 'interrupted']) {
    assert.deepEqual(checkQueueInvariants(withQueue([item('a', s), item('b', 'queued', 'a')])), [], `after '${s}'`);
  }
  const dir = withQueue([item('a', 'taken'), item('b', 'queued', 'a')], [{ id: 'ra', queueItemId: 'a', status: 'awaiting_approval' }]);
  assert.deepEqual(checkQueueInvariants(dir), []);
});

test('ORPHAN fires on a taken item whose only run already FINISHED', () => {
  // The success-path shape fixed earlier: run done, item never completed.
  const dir = withQueue([item('a', 'taken')], [{ id: 'ra', queueItemId: 'a', status: 'done' }]);
  assert.deepEqual(qkinds(dir), ['ORPHAN']);
});

test('ORPHAN fires on a taken item with no run at all', () => {
  assert.deepEqual(qkinds(withQueue([item('a', 'taken')])), ['ORPHAN']);
});

test('a taken item owned by a run that is running / awaiting approval / interrupted is NOT an orphan', () => {
  for (const s of ['running', 'awaiting_approval', 'interrupted']) {
    const dir = withQueue([item('a', 'taken')], [{ id: 'ra', queueItemId: 'a', status: s }]);
    assert.deepEqual(checkQueueInvariants(dir), [], `run '${s}'`);
  }
});

test('QUEUEFILE fires on a truncated queue.json - and reports nothing it cannot trust', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'queue.json'), '{"items":[{"id":"a","status":"tak', 'utf8');
  assert.deepEqual(qkinds(dir), ['QUEUEFILE']);
});

test('QUEUEFILE fires on valid JSON with no items array', () => {
  const { dir } = healthy();
  writeFileSync(join(dir, 'queue.json'), '{"items":{}}', 'utf8');
  assert.deepEqual(qkinds(dir), ['QUEUEFILE']);
});

test('QUEUEFILE fires on a corrupt queue the hub already quarantined', () => {
  // queue.js load() moves a damaged file aside on read, so at check time the only trace of
  // the corruption may be the quarantined copy. STRAY also sees it - correctly.
  const dir = withQueue([item('a', 'done')]);
  writeFileSync(join(dir, 'queue.json.corrupt-2026-09-10T00-00-00-000Z'), '{"items":[', 'utf8');
  assert.deepEqual(qkinds(dir), ['QUEUEFILE']);
  assert.deepEqual(kinds(checkInvariants(dir)), ['STRAY']);
});

// ── the same states, produced by the hub's OWN queue module, not hand-written JSON ─────
// Proves the checker reads the format the hub really writes, and that STRANDED is a real,
// reachable state: dequeue() will not hand out the tail, whatever the supervisor does.
{
  const { dir } = healthy();
  process.env.AGENT_QUEUE_FILE = join(dir, 'queue.json');
  const q = await import('./queue.js');
  const a = q.enqueue('real chain step 1').item;
  const b = q.enqueue('real chain step 2', { after: a.id }).item;
  test('real queue.js: a step taken and never finished is an ORPHAN', () => {
    assert.equal(q.dequeue({ completedIds: [] }).id, a.id);
    assert.deepEqual(qkinds(dir), ['ORPHAN']);
  });
  test('real queue.js: head completed as stopped strands the tail, and dequeue confirms it', () => {
    q.complete(a.id, { status: 'stopped', runId: 'r-a' });
    const done = q.list().filter((i) => i.status === 'done').map((i) => i.id);
    assert.equal(q.dequeue({ completedIds: done }), null, 'the tail must be unreachable for this to be STRANDED');
    assert.deepEqual(qkinds(dir), ['STRANDED']);
    assert.match(checkQueueInvariants(dir)[0], new RegExp(`${b.id} waits on ${a.id}, which ended 'stopped'`));
  });
  delete process.env.AGENT_QUEUE_FILE;
}

// ── hostile corpus classifier (fuzzLoop --mode=hostile) ────────────────────────────────
console.log('\nhostile corpus classifier\n');
const row = (text, actions, hasThought = true) => ({ text, actions, hasThought });
const WRITE_PKG = 'THOUGHT: fix deps\nACTION: write_file\nPATH: package.json\n```json\n{"type":"module"}\n```';

test('an ordinary one-action reply is in NO hostile category', () => {
  assert.deepEqual(hostileCategories(row('THOUGHT: go\nACTION: write_file\nPATH: a.js\n```js\nmodule.exports = 1;\n```', ['write_file'])), []);
});
test('multi fires on more than one action', () => {
  assert.deepEqual(hostileCategories(row('THOUGHT: x\nACTION: read_file\nPATH: a.js\nACTION: finish', ['read_file', 'finish'])), ['multi']);
});
test('pkgFirst fires when the FIRST action writes package.json, not when a later one does', () => {
  assert.deepEqual(hostileCategories(row(WRITE_PKG, ['write_file'])), ['pkgFirst']);
  const later = 'THOUGHT: x\nACTION: read_file\nPATH: a.js\n' + WRITE_PKG.replace('THOUGHT: fix deps\n', '');
  assert.deepEqual(hostileCategories(row(later, ['read_file', 'write_file'])), ['multi']);
});
test('lineNumbers fires on read_file prefixes in a fence, not on indented numeric keys', () => {
  const leaked = 'THOUGHT: x\nACTION: write_file\nPATH: a.js\n```js\n1: const a = 1;\n2: module.exports = a;\n```';
  assert.deepEqual(hostileCategories(row(leaked, ['write_file'])), ['lineNumbers']);
  const keys = 'THOUGHT: x\nACTION: write_file\nPATH: a.js\n```js\nmodule.exports = {\n  1: "one",\n  2: "two",\n};\n```';
  assert.deepEqual(hostileCategories(row(keys, ['write_file'])), []);
});
test('noThought fires without a THOUGHT, but never on a planner turn', () => {
  assert.deepEqual(hostileCategories(row('ACTION: finish', ['finish'], false)), ['noThought']);
  assert.deepEqual(hostileCategories(row('BUILD PLAN:\n1. do it', [], false)), []);
  assert.deepEqual(hostileCategories(row('1. WHAT IT DOES: adds', [], false)), []);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
