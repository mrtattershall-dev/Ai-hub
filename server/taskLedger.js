/**
 * taskLedger.js - the agent's checklist, on disk.
 *
 * WHY A LEDGER AND NOT JUST THE PLAN
 * ----------------------------------
 * The context window is 16 messages. pruneHistory preserves the GOAL and the BUILD PLAN
 * by marker, which keeps the *intent* alive - but the plan is written once, at step 1,
 * and never updated. It says what to build. It never says what is DONE.
 *
 * So on a long run the agent was re-deriving its own progress from whatever happened to
 * be in the last few messages. That is how you get a six-hour run that rebuilds the same
 * file three times, or declares victory with half the plan untouched.
 *
 * The ledger is the missing half: a small, mutable record of what is finished, what is
 * in progress, and what is left. Two properties make it work:
 *
 *   1. It lives on DISK, so it survives pruning, a restart, and the end of the run.
 *   2. It is re-injected FRESH before every single model call rather than being pushed
 *      into history once. Pruning cannot drop it, because it was never in the history
 *      to begin with - and it is always current rather than a stale copy from step 1.
 *
 * Format is deliberately markdown a human can read and edit by hand:
 *
 *   - [ ] 1. not started
 *   - [>] 2. in progress
 *   - [x] 3. done
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const FILE = 'TASKS.md';
const HEADER = '# Tasks\n\nThe agent\'s checklist. `[ ]` todo, `[>]` in progress, `[x]` done.\n\n';
const MARK = { todo: ' ', doing: '>', done: 'x' };
// How many entries the ledger holds. Past this, COMPLETED tasks are evicted first
// (their record lives in the git log); pending work is only dropped as a last resort,
// and the agent is told when that happens.
const CAP = 60;
const STATE = { ' ': 'todo', '>': 'doing', x: 'done', X: 'done' };

const pathOf = (workspace) => join(workspace, FILE);

/** Parse the file into [{ n, state, title }]. Tolerant of hand-editing. */
export function read(workspace) {
  const f = pathOf(workspace);
  if (!existsSync(f)) return [];
  const out = [];
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\[([ >xX])\]\s*(?:(\d+)\.\s*)?(.+?)\s*$/);
    if (m) {
      const raw = m[3];
      const carried = raw.includes(CARRIED);
      out.push({
        n: out.length + 1,
        state: STATE[m[1]] || 'todo',
        title: raw.replace(CARRIED, '').trim(),
        ...(carried ? { carried: true } : {}),
      });
    }
  }
  return out;
}

// A marker so `add` can tell "this ledger came from the plan and nobody has touched it"
// apart from "the agent built this list itself". An HTML comment, so the file stays
// readable and hand-editable markdown.
const PLAN_MARK = '<!-- seeded-from-plan -->';

// Per-task marker for work INHERITED from an earlier run in this workspace.
const CARRIED = '<!--carried-->';

function write(workspace, tasks, fromPlan = false) {
  const body = HEADER + (fromPlan ? PLAN_MARK + '\n\n' : '')
    + tasks.map((t, i) => `- [${MARK[t.state] || ' '}] ${i + 1}. ${t.title}${t.carried ? ' ' + CARRIED : ''}`).join('\n') + '\n';
  writeFileSync(pathOf(workspace), body, 'utf8');
  return tasks;
}

/** Was this ledger written by the plan-first gate rather than by the agent itself? */
export function isPlanSeeded(workspace) {
  const f = pathOf(workspace);
  if (!existsSync(f)) return false;
  try { return readFileSync(f, 'utf8').includes(PLAN_MARK); } catch { return false; }
}

/**
 * Called once when a NEW top-level run starts. Any task still open belongs to an EARLIER
 * run, so it is marked carried: still visible, never binding.
 *
 * WHY. One workspace is shared across runs on purpose - NOTES.md and the git history are
 * the agent's memory. TASKS.md rode along on that, and the plan gate only seeds "if the
 * ledger is empty", so run 2 silently inherited run 1's leftovers. If run 1 had called
 * task_add the plan marker was gone too, so the inherited tasks counted as commitments
 * and run 2's finish gate blocked on work it had never agreed to do. Found 2026-09-09,
 * right after concurrent runs were serialized made this the ORDINARY path rather than a
 * rare one.
 *
 * Deleting them would be wrong - "what was still outstanding" is exactly the kind of
 * memory a workspace should keep, and the next goal is often the continuation. So they
 * stay in the file and in the model's context, labelled, and simply do not gate.
 *
 * A follow-up on the SAME run must not call this: it is the same commitment continuing.
 */
export function adopt(workspace, runId) {
  const tasks = read(workspace);
  if (!tasks.length) return { carried: 0 };
  let carried = 0;
  for (const t of tasks) {
    if (t.state !== 'done' && !t.carried) { t.carried = true; carried++; }
  }
  if (carried) write(workspace, tasks, isPlanSeeded(workspace));
  return { carried };
}

/** Replace the whole list. Used to seed the ledger from the BUILD PLAN. */
export function seed(workspace, titles) {
  const tasks = titles
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((title) => ({ state: 'todo', title: title.slice(0, 160) }));
  return write(workspace, tasks, true);   // mark it plan-derived, so task_add can supersede it
}

/**
 * Append one or more tasks discovered mid-run.
 *
 * THE DOUBLE-SEEDING BUG (found 2026-09-09 by the long-run harness)
 * ----------------------------------------------------------------
 * The plan-first gate seeds a ledger from the BUILD PLAN. The system prompt then tells
 * the agent "At the start, task_add the work the goal needs". So a well-behaved agent
 * produced this:
 *
 *     [x] 1. a single module               <- from the plan
 *     [x] 2. write it, then verify it      <- from the plan
 *     [ ] 3. write the calculator module   <- the agent's own, SAME WORK
 *     [ ] 4. verify it runs                <- the agent's own, SAME WORK
 *
 * It closed the two it knew about, and the finish gate then blocked forever on two
 * duplicates it had already done. The agent was following its instructions exactly; the
 * seeding fought them.
 *
 * So: the first task_add on a ledger that is still ENTIRELY plan-seeded and untouched
 * replaces it. The agent's own list is closer to what it will actually do than a list
 * derived from prose. Once any task has been started or finished, appending resumes -
 * real progress is never discarded.
 */
export function add(workspace, titles) {
  let tasks = read(workspace);
  const pristinePlan = isPlanSeeded(workspace) && tasks.length > 0
    && tasks.every((t) => t.state === 'todo');
  if (pristinePlan) tasks = [];

  let added = 0;
  for (const t of [].concat(titles)) {
    const title = String(t).trim().slice(0, 160);
    if (title && !tasks.some((x) => x.title === title)) { tasks.push({ state: 'todo', title }); added++; }
  }

  // THE CAP USED TO LIE (found 2026-09-09 by the 20-minute marathon run).
  //
  // `tasks.slice(0, 60)` truncated from the END, so once a long run passed 60 entries
  // every further task_add silently did nothing while still reporting "OK: added N".
  // The agent believed it had recorded work it had not — the worst possible failure for
  // a ledger, whose entire job is to be trusted.
  //
  // Now: make room by evicting COMPLETED tasks oldest-first. They are history, and the
  // real record of them is the git log. Only if that is not enough do we drop anything
  // pending, and then we say so out loud.
  let evicted = 0;
  while (tasks.length > CAP) {
    const i = tasks.findIndex((t) => t.state === 'done');
    if (i < 0) break;
    tasks.splice(i, 1);
    evicted++;
  }
  const dropped = Math.max(0, tasks.length - CAP);
  if (dropped) tasks = tasks.slice(0, CAP);

  write(workspace, tasks, false);
  return { tasks, added, evicted, dropped };
}

/**
 * Set a task's state. Accepts a number OR a substring of the title, because a small
 * model reliably produces one or the other but not always the one you asked for.
 */
export function mark(workspace, which, state) {
  const tasks = read(workspace);
  if (!tasks.length) return { ok: false, error: 'there are no tasks yet' };
  let i = -1;
  const n = parseInt(which, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= tasks.length) i = n - 1;
  else {
    const q = String(which || '').toLowerCase().trim();
    if (q) i = tasks.findIndex((t) => t.title.toLowerCase().includes(q));
  }
  if (i < 0) return { ok: false, error: `no task matches "${which}"` };
  // Starting a new task implicitly ends the previous one's "in progress" state, so
  // the ledger can never show two things being worked on at once.
  if (state === 'doing') tasks.forEach((t) => { if (t.state === 'doing') t.state = 'todo'; });
  tasks[i].state = state;
  write(workspace, tasks);
  return { ok: true, task: tasks[i], n: i + 1 };
}

export function progress(workspace) {
  const tasks = read(workspace);
  const done = tasks.filter((t) => t.state === 'done').length;
  const open = tasks.filter((t) => t.state !== 'done');
  return {
    total: tasks.length,
    done,
    remaining: open.length,
    // What the finish gate may hold a run to: only tasks THIS run took on.
    remainingOwn: open.filter((t) => !t.carried).length,
    carried: open.filter((t) => t.carried).length,
  };
}

/**
 * The compact form injected before every model call. Kept small on purpose - it is
 * paid for on every single step, so it must cost tens of tokens, not hundreds.
 * Done items collapse to a count; what is left is what the agent needs to see.
 */
export function contextBlock(workspace) {
  const tasks = read(workspace);
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.state === 'done');
  const rest = tasks.filter((t) => t.state !== 'done');
  const lines = rest.slice(0, 12).map((t, i) => {
    const n = tasks.indexOf(t) + 1;
    // Say where a carried task came from. Unlabelled, a model reads another run's
    // leftovers as its own forgotten work: on 2026-09-09 one run planned a task to
    // "mark obsolete parse.js work as intentionally out of scope" for exactly that
    // reason. It needs to know this is context, not an instruction.
    return `  ${t.state === 'doing' ? '>' : ' '} ${n}. ${t.title}${t.carried ? '  (left over from earlier work — only do this if the goal needs it)' : ''}`;
  });
  const more = rest.length > 12 ? `\n  … and ${rest.length - 12} more` : '';
  return `TASK LEDGER (TASKS.md — ${done.length}/${tasks.length} done)\n`
    + `Remaining:\n${lines.join('\n')}${more}\n`
    + `Mark a task done as soon as it works (ACTION: task_done). When every task is done, finish.`;
}

/**
 * Pull a task list out of a BUILD PLAN. The planner is told to emit a numbered list,
 * so numbered lines are the signal; bullets are the fallback for when it does not.
 */
export function fromPlan(planText) {
  const lines = String(planText || '').split(/\r?\n/);
  const out = [];
  for (const raw of lines) {
    const l = raw.trim();
    // Skip the planner's own section headings (e.g. "1. SYSTEMS NEEDED") - they are
    // categories, not work items.
    if (/^\d+\.\s*[A-Z][A-Z\s/]{3,}$/.test(l)) continue;
    const m = l.match(/^(?:\d+\.\d+|\d+\)|[-*•])\s+(.{4,})$/);
    if (m) out.push(m[1].replace(/\*\*/g, '').trim());
  }
  return out.slice(0, 30);
}
