/**
 * queue.js - a work list the agent pulls from by itself.
 *
 * Every way into the agent was a human pressing something: POST /start, /followup,
 * /approve. Nothing let it pick up the next piece of work on its own, so "autonomous"
 * meant "autonomous within one goal, then idle until a person came back".
 *
 * A human coder finishing a ticket takes the next ticket. This is that: a durable,
 * ordered list of goals, and a supervisor (in agent.js) that pulls the next one when a
 * run ends.
 *
 * Deliberately a plain JSON file, not the SQLite DB: it must survive a crash, be
 * editable by hand when something goes wrong at 3am, and never take a lock the agent
 * loop could block on.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, openSync, closeSync, unlinkSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { readJsonSafe, renameWithRetry } from './safeJson.js';

/**
 * The backlog file. Overridable so a test never has to touch the live one.
 *
 * queueChain.test.mjs and repairChain.test.mjs both open with a warning that they operate
 * on the real queue and restore it in a `finally` - which works until one of them dies
 * hard, and which cannot protect a queue that a running hub is writing at the same time.
 * A test that needs its own backlog should set AGENT_QUEUE_FILE and stop taking that risk.
 */
const FILE = process.env.AGENT_QUEUE_FILE || join(__dirname, 'agent-queue.json');


function load() {
  // 'quarantine', not 'throw': a queue read happens mid-run, and stopping a live run is
  // worse than starting a fresh backlog. The damaged file is moved aside rather than
  // overwritten, so nothing is actually lost - it used to be read as empty and then
  // saved over, silently deleting the whole backlog.
  const j = readJsonSafe(FILE, {
    empty: { items: [] }, label: 'agent-queue.json', onUnrecoverable: 'quarantine',
  });
  return { items: Array.isArray(j.items) ? j.items : [] };
}

// Atomic: a torn write here would lose the whole backlog, and this file is written
// from the agent loop while a run is finishing.
function save(state) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameWithRetry(tmp, FILE);
  } catch { /* a queue write must never kill a run */ }
}

/**
 * A cross-process lock around read-modify-write.
 *
 * WHY. Every mutator below is `load() -> change -> save()`, and the write is atomic, which
 * makes a TORN file impossible but does nothing about a LOST UPDATE: two processes both
 * read, both change their own copy, and the second save silently discards the first's
 * work. Measured 2026-09-10 - a second hub on a spare port queued a four-goal chain, the
 * first hub's next save overwrote the file, and all four vanished mid-flight while a run
 * carried on executing a queue item that no longer existed.
 *
 * That is not an artefact of running two hubs. `FILE` is a fixed path, and
 * queueChain.test.mjs and repairChain.test.mjs both say in their own headers that they
 * touch the live queue. For a system whose queue IS its memory overnight, a lost update
 * is lost work with no trace.
 *
 * The wait is deliberately bounded and the lock deliberately breakable. This file's own
 * contract is that it must "never take a lock the agent loop could block on", so after
 * LOCK_WAIT_MS we proceed unlocked - degrading to exactly the old behaviour rather than
 * wedging a run - and a lock older than LOCK_STALE_MS is assumed to belong to a crashed
 * process and taken. Both are far longer than a read-modify-write of a small JSON file.
 */
const LOCK = FILE + '.lock';
const LOCK_WAIT_MS = 750;
const LOCK_STALE_MS = 10_000;

// A real sleep rather than a spin: these calls are synchronous and on the main thread, so
// busy-waiting would burn the very event loop we are trying not to block.
const SLEEPER = new Int32Array(new SharedArrayBuffer(4));
const sleepSync = (ms) => { try { Atomics.wait(SLEEPER, 0, 0, ms); } catch { /* not permitted here */ } };

function withLock(fn) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let fd = null;
  for (;;) {
    try { fd = openSync(LOCK, 'wx'); break; }         // 'wx' = create-exclusive: the lock
    catch (e) {
      if (e.code !== 'EEXIST') break;                 // cannot lock at all - proceed unlocked
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > LOCK_STALE_MS) { unlinkSync(LOCK); continue; }
      } catch { continue; }                           // it vanished under us; try to take it
      if (Date.now() > deadline) break;               // waited long enough - proceed unlocked
      sleepSync(15);
    }
  }
  try {
    return fn();
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch {}
      try { unlinkSync(LOCK); } catch {}
    }
  }
}

export function list() {
  return load().items;
}

/**
 * Goal identity for dedup. Two goals that differ only in case, spacing or trailing
 * punctuation are the same piece of work to a human, and the model phrases the same
 * follow-up slightly differently every time it is asked.
 */
function norm(goal) {
  return String(goal || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '').trim();
}

/**
 * Add work. `after` lets a run queue a follow-on that depends on it.
 *
 * DEDUP IS LOAD-BEARING, NOT A NICETY. Measured 2026-09-09: with the supervisor on, a
 * model that ends each run by suggesting a follow-up produced 40 runs in 60 seconds, all
 * of them the same goal, because a finished run queued the work it had just finished. On
 * a metered API that is an unattended chain of billable runs. A goal already waiting, in
 * flight, or already completed is refused here - the narrowest place that catches it for
 * every caller (HTTP route, queue_goal tool, supervisor).
 *
 * Pass `force` for the human case: re-running something deliberately is legitimate, and a
 * person typing it again is an explicit instruction, not a runaway loop.
 */
function enqueueLocked(goal, { priority = 0, source = 'human', after = null, force = false, generation = 0, repairOf = null } = {}) {
  const g = String(goal || '').trim();
  if (!g) return { ok: false, error: 'goal is required' };
  const s = load();
  if (!force) {
    const key = norm(g);
    const dupe = s.items.find((i) => norm(i.goal) === key && ['queued', 'taken', 'done'].includes(i.status));
    if (dupe) {
      return {
        ok: false, duplicate: true, item: dupe,
        error: `already ${dupe.status === 'done' ? 'completed' : dupe.status} as ${dupe.id}: ${dupe.goal.slice(0, 80)}`,
        depth: s.items.filter((i) => i.status === 'queued').length,
      };
    }
  }
  const item = {
    id: randomUUID().slice(0, 8),
    goal: g.slice(0, 2000),
    priority: Number(priority) || 0,
    source, after,
    // How many machine-to-machine hops produced this item. A human's goal is 0; work
    // queued by a run started from a generation-N item is N+1. The supervisor refuses
    // to auto-start past a cap, which bounds chains of DIFFERENT goals that dedup
    // cannot see.
    generation: Math.max(0, Number(generation) || 0),
    // The item this one is a second attempt at, or null. Load-bearing for termination:
    // a repair is never itself repaired, so one failed goal can produce at most one extra
    // run no matter what it fails with. Dedup cannot do that job here - the second
    // failure usually carries a different error string, so the goals differ.
    repairOf,
    createdAt: Date.now(),
    status: 'queued',
  };
  s.items.push(item);
  save(s);
  return { ok: true, item, depth: s.items.filter((i) => i.status === 'queued').length };
}

/**
 * Take the next item. Highest priority first, then oldest - so a human's urgent
 * addition jumps the agent's own self-queued follow-ups without starving them.
 */
function dequeueLocked({ completedIds = [] } = {}) {
  const s = load();
  const ready = s.items
    .filter((i) => i.status === 'queued')
    .filter((i) => !i.after || completedIds.includes(i.after))
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt - b.createdAt));
  const next = ready[0];
  if (!next) return null;
  next.status = 'taken';
  next.takenAt = Date.now();
  save(s);
  return next;
}

function completeLocked(id, { status = 'done', runId = null, summary = '' } = {}) {
  const s = load();
  const it = s.items.find((i) => i.id === id);
  if (it) {
    it.status = status;
    it.runId = runId;
    it.summary = String(summary || '').slice(0, 500);
    it.finishedAt = Date.now();
    save(s);
  }
  return it || null;
}

/**
 * Put a taken item back on the list. Used when the supervisor declines to auto-start
 * something: the work is still wanted, it just needs a human to release it, so it must
 * not be left stuck in 'taken' (invisible to dequeue until the next restart).
 */
function releaseLocked(id) {
  const s = load();
  const it = s.items.find((i) => i.id === id);
  if (it && it.status === 'taken') { it.status = 'queued'; delete it.takenAt; it.heldAt = Date.now(); save(s); }
  return it || null;
}

/**
 * Move everything waiting on `fromId` to wait on `toId` instead. Returns the ids moved.
 *
 * Used when a chain step fails and a repair is spliced in: the rest of the chain was
 * waiting on a goal that will now never reach 'done', so without this the tail is stranded
 * even if the repair succeeds. Re-pointing keeps the order the plan asked for.
 */
function repointLocked(fromId, toId) {
  const s = load();
  const moved = [];
  for (const i of s.items) {
    if (i.after === fromId && i.status === 'queued') { i.after = toId; moved.push(i.id); }
  }
  if (moved.length) save(s);
  return moved;
}

function removeLocked(id) {
  const s = load();
  const before = s.items.length;
  s.items = s.items.filter((i) => i.id !== id);
  save(s);
  return { ok: s.items.length < before };
}

/** Drop finished items so the file does not grow forever. */
function pruneLocked(keep = 50) {
  const s = load();
  const active = s.items.filter((i) => i.status === 'queued' || i.status === 'taken');
  const finished = s.items.filter((i) => !['queued', 'taken'].includes(i.status))
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)).slice(0, keep);
  s.items = [...active, ...finished];
  save(s);
  return s.items.length;
}

export function depth() {
  return load().items.filter((i) => i.status === 'queued').length;
}

/** Anything left half-taken after a crash goes back on the list. */
function requeueOrphansLocked() {
  const s = load();
  let n = 0;
  for (const i of s.items) if (i.status === 'taken') { i.status = 'queued'; delete i.takenAt; n++; }
  if (n) save(s);
  return n;
}

/*
 * Everything that changes the file goes through the lock; `list()` and `depth()` are
 * pure reads and deliberately do not, so a status poll can never wait on a write.
 *
 * Wrapped here rather than inside each function so the bodies stay exactly as they were -
 * a lock is easy to get wrong by leaking an early return, and there are no early returns
 * to leak when the whole call is the critical section.
 */
export const enqueue        = (...a) => withLock(() => enqueueLocked(...a));
export const dequeue        = (...a) => withLock(() => dequeueLocked(...a));
export const complete       = (...a) => withLock(() => completeLocked(...a));
export const release        = (...a) => withLock(() => releaseLocked(...a));
export const repoint        = (...a) => withLock(() => repointLocked(...a));
export const remove         = (...a) => withLock(() => removeLocked(...a));
export const prune          = (...a) => withLock(() => pruneLocked(...a));
export const requeueOrphans = (...a) => withLock(() => requeueOrphansLocked(...a));
