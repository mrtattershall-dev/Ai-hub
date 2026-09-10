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
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'agent-queue.json');

function load() {
  try {
    if (!existsSync(FILE)) return { items: [] };
    const j = JSON.parse(readFileSync(FILE, 'utf8'));
    return { items: Array.isArray(j.items) ? j.items : [] };
  } catch { return { items: [] }; }
}

// Atomic: a torn write here would lose the whole backlog, and this file is written
// from the agent loop while a run is finishing.
function save(state) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tmp, FILE);
  } catch { /* a queue write must never kill a run */ }
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
export function enqueue(goal, { priority = 0, source = 'human', after = null, force = false, generation = 0 } = {}) {
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
export function dequeue({ completedIds = [] } = {}) {
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

export function complete(id, { status = 'done', runId = null, summary = '' } = {}) {
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
export function release(id) {
  const s = load();
  const it = s.items.find((i) => i.id === id);
  if (it && it.status === 'taken') { it.status = 'queued'; delete it.takenAt; it.heldAt = Date.now(); save(s); }
  return it || null;
}

export function remove(id) {
  const s = load();
  const before = s.items.length;
  s.items = s.items.filter((i) => i.id !== id);
  save(s);
  return { ok: s.items.length < before };
}

/** Drop finished items so the file does not grow forever. */
export function prune(keep = 50) {
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
export function requeueOrphans() {
  const s = load();
  let n = 0;
  for (const i of s.items) if (i.status === 'taken') { i.status = 'queued'; delete i.takenAt; n++; }
  if (n) save(s);
  return n;
}
