/**
 * queueLock.test.mjs - concurrent writers must not lose each other's work.
 *
 *   node server/queueLock.test.mjs
 *
 * Uses its own queue file via AGENT_QUEUE_FILE, so unlike the other queue tests it cannot
 * touch yours even if it dies hard.
 *
 * WHAT IS BEING PINNED. `save()` was already atomic, so a torn file was impossible - but
 * every mutator is `load() -> change -> save()`, and nothing made that sequence atomic
 * ACROSS processes. Two writers both read, both change their own copy, and the second
 * save silently discards the first's items. Measured 2026-09-10: a four-goal chain queued
 * by a second hub vanished mid-flight when the first hub next saved, while a run carried
 * on executing a queue item that no longer existed.
 *
 * The failure is invisible by construction - no error, no torn JSON, just fewer items than
 * were put in - so it needs a test that counts.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'qlock-'));
const QUEUE = join(dir, 'agent-queue.json');

// Set BEFORE queue.js is imported anywhere in this process - it reads the path once, at
// module load. Getting this wrong is not a failing test, it is a test that quietly edits
// your live backlog: the first version of this file only put AGENT_QUEUE_FILE in the
// CHILD processes' env, so the in-process case below ran against the real queue and lost
// a goal that a running hub had queued seconds earlier. Which is, precisely, the bug
// under test - demonstrated on the author rather than on the code.
process.env.AGENT_QUEUE_FILE = QUEUE;

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const reset = () => writeFileSync(QUEUE, JSON.stringify({ items: [] }, null, 2), 'utf8');
const readItems = () => JSON.parse(readFileSync(QUEUE, 'utf8')).items;

/** One child process that hammers enqueue with its own distinctly-named goals. */
const WRITER = `
import * as q from ${JSON.stringify(pathToFileURL(join(__dirname, 'queue.js')).href)};
const tag = process.argv[2];
const n = Number(process.argv[3]);
for (let i = 0; i < n; i++) q.enqueue(tag + ' goal ' + i, { force: true });
`;

const writerFile = join(dir, 'writer.mjs');
writeFileSync(writerFile, WRITER, 'utf8');

const runWriters = (count, each) => Promise.all(
  Array.from({ length: count }, (_, w) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [writerFile, `w${w}`, String(each)], {
      env: { ...process.env, AGENT_QUEUE_FILE: QUEUE },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`writer ${w} exited ${code}: ${err.slice(-300)}`))));
  })),
);

try {
  await test('AGENT_QUEUE_FILE actually redirects the backlog', async () => {
    reset();
    await runWriters(1, 3);
    assert.equal(readItems().length, 3);
    // The point of the override: the real queue must be untouched by a test run.
    const live = join(__dirname, 'agent-queue.json');
    if (existsSync(live)) {
      assert.ok(!JSON.stringify(readFileSync(live, 'utf8')).includes('w0 goal'),
        'the live queue must not contain this test\'s goals');
    }
  });

  await test('six concurrent writers lose nothing', async () => {
    reset();
    const WRITERS = 6, EACH = 12;
    await runWriters(WRITERS, EACH);
    const items = readItems();
    // Without the lock this comes back short and non-deterministically so - the whole
    // point is that the shortfall is silent, so assert the exact count.
    assert.equal(items.length, WRITERS * EACH,
      `expected ${WRITERS * EACH} items, got ${items.length} - a concurrent save clobbered someone`);
    const ids = new Set(items.map((i) => i.id));
    assert.equal(ids.size, items.length, 'ids collided');
    for (let w = 0; w < WRITERS; w++) {
      const mine = items.filter((i) => i.goal.startsWith(`w${w} `));
      assert.equal(mine.length, EACH, `writer w${w} landed ${mine.length}/${EACH}`);
    }
  });

  await test('a mixed workload keeps the file valid and the counts right', async () => {
    reset();
    const q = await import(`./queue.js?mixed=${Date.now()}`);
    // Belt and braces: prove this module is pointed at the temp file before it writes.
    const liveBefore = existsSync(join(__dirname, 'agent-queue.json'))
      ? readFileSync(join(__dirname, 'agent-queue.json'), 'utf8') : null;
    // Same-process interleaving still has to behave: the lock is re-entrant only in the
    // sense that nothing here nests, so a plain sequence must not deadlock itself.
    q.enqueue('alpha', { force: true });
    q.enqueue('beta', { force: true });
    const taken = q.dequeue({ completedIds: [] });
    assert.ok(taken, 'something was dequeued');
    q.complete(taken.id, { status: 'done' });
    q.enqueue('gamma', { force: true });
    const items = readItems();
    assert.equal(items.length, 3);
    assert.equal(items.filter((i) => i.status === 'done').length, 1);

    const liveAfter = existsSync(join(__dirname, 'agent-queue.json'))
      ? readFileSync(join(__dirname, 'agent-queue.json'), 'utf8') : null;
    assert.equal(liveAfter, liveBefore, 'the live queue was modified by a test - byte for byte, it must not be');
  });

  await test('a stale lock left by a crashed writer is broken, not waited on forever', async () => {
    reset();
    writeFileSync(QUEUE + '.lock', '', 'utf8');
    // Backdate it well past LOCK_STALE_MS.
    const old = new Date(Date.now() - 60_000);
    const { utimesSync } = await import('node:fs');
    utimesSync(QUEUE + '.lock', old, old);
    const started = Date.now();
    await runWriters(1, 2);
    assert.equal(readItems().length, 2, 'the writer got through');
    assert.ok(Date.now() - started < 20_000, 'and did not hang waiting on a dead lock');
  });

  await test('the lock file is not left behind', async () => {
    reset();
    await runWriters(2, 5);
    assert.ok(!existsSync(QUEUE + '.lock'), 'lock released');
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`queueLock: ${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
