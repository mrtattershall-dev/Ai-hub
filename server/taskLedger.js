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
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'fs';
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
      const aged = raw.includes(AGED);
      out.push({
        n: out.length + 1,
        state: STATE[m[1]] || 'todo',
        title: raw.replace(CARRIED, '').replace(AGED, '').trim(),
        ...(carried ? { carried: true } : {}),
        ...(aged ? { aged: true } : {}),
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

// Per-task marker for a carried task that has been carried past a SECOND run start: it is not from the goal just
// before this one. Set E (2026-09-11): the first goal's plan tasks stayed on the ledger of every later interleaved
// goal ("0/9 done"), sent with every model call, and the 14B acted on them - goal 8 (q8_units.py) closed "Create
// q1_stock.js". A leftover now shows only where it can matter: a task naming a file shows when the goal names that
// file (so "Re-add X to f" reaches the next goal on f, however many goals later); a task naming no file shows for the
// one goal right after its own, then drops out of the per-call block. TASKS.md itself keeps everything.
const AGED = '<!--aged-->';
const FILE_RE = /[\w./-]+\.(?:js|mjs|cjs|py|html?|md|json|css|ts|gd|txt|csv)\b/gi;
export function namedFiles(text) {
  return [...new Set((String(text || '').match(FILE_RE) || []).map((f) => f.toLowerCase().replace(/^\.\//, '')))];
}

function write(workspace, tasks, fromPlan = false) {
  const body = HEADER + (fromPlan ? PLAN_MARK + '\n\n' : '')
    + tasks.map((t, i) => `- [${MARK[t.state] || ' '}] ${i + 1}. ${t.title}${t.carried ? ' ' + CARRIED : ''}${t.aged ? ' ' + AGED : ''}`).join('\n') + '\n';

  // ATOMIC. TASKS.md is the agent's memory of what it is doing and what it has finished,
  // and it is rewritten in full on every mark/add - dozens of times in a long run, from
  // the run loop, from sub-tasks and from the supervisor. A plain writeFileSync truncates
  // the file and then fills it, so anything that interrupts the middle of that - a crash,
  // a Stop, a second writer - leaves a half-written ledger. This file has been corrupted
  // in exactly that way before (six concurrent runs, 2026-09). `activeTopLevelRun()` stops
  // the concurrent case; this stops the interrupted-write case, which no guard can.
  //
  // rename() is atomic on the same volume, so a reader sees either the whole old ledger or
  // the whole new one. The temp file sits beside the target for that reason - a temp on
  // another volume would make rename a copy, and copies are not atomic.
  const target = pathOf(workspace);
  const tmp = target + '.tmp';
  try {
    writeFileSync(tmp, body, 'utf8');
    renameSync(tmp, target);
  } catch (e) {
    // Never let a ledger write kill a run: the ledger is a record OF the work, not the
    // work itself. Fall back to the direct write rather than losing the update entirely.
    try { unlinkSync(tmp); } catch {}
    try { writeFileSync(target, body, 'utf8'); }
    catch { console.error('[ledger] could not write TASKS.md:', e.message); }
  }
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
  if (!tasks.length) return { carried: 0, prior: 0 };
  // EVERY task present when a run starts is prior work - the DONE ones too. Only open ones
  // used to be marked, so tasks earlier runs had completed still counted as this run's own:
  // in the 14B data run (2026-09-10, goal 9) closing one carried task left "remainingOwn" at
  // 0 and task_done announced "ALL 3 TASKS FOR THIS GOAL ARE COMPLETE" for a goal that had no
  // tasks at all. `carried` keeps its meaning (unfinished leftovers, for the run-start note);
  // `prior` counts everything marked.
  let carried = 0, prior = 0, aged = 0;
  for (const t of tasks) {
    // Already carried once, so now at least two goals old (see AGED).
    if (t.carried) { if (!t.aged && t.state !== 'done') { t.aged = true; aged++; } continue; }
    t.carried = true;
    prior++;
    if (t.state !== 'done') carried++;
  }
  if (prior || aged) write(workspace, tasks, isPlanSeeded(workspace));
  return { carried, prior };
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
 * Does `q` appear inside `title` at WORD BOUNDARIES? The last resort for a title match.
 *
 * `includes()` was the whole match rule, and a bare substring closes the wrong task: "ibrary.js with" matched
 * "Create s1_library.js with the Library class" mid-word. A boundary check keeps the useful case (the model quotes a
 * few whole words of the title) and drops the accidental one.
 */
function wordMatch(title, q) {
  const isWord = (c) => c !== undefined && /\w/.test(c);
  for (let k = title.indexOf(q); k !== -1; k = title.indexOf(q, k + 1)) {
    const startsClean = !isWord(q[0]) || !isWord(title[k - 1]);
    const endsClean = !isWord(q[q.length - 1]) || !isWord(title[k + q.length]);
    if (startsClean && endsClean) return true;
  }
  return false;
}

/**
 * Set a task's state.
 *
 * WHAT THIS ACCEPTS, AND WHY (set G, 2026-09-11 - measured in the kept run records, not inferred)
 * ----------------------------------------------------------------------------------------------
 * 44 real task_done calls across the two batteries. ZERO returned "no task matches". 43 of them closed a task left
 * over from GOAL 1 while the model was working on an entirely different goal - 39 of 40 in the 30B battery all
 * answering `OK: "HOW TO VERIFY: Run node s1_library.js ..." done`, and 4 of 4 in the 14B. A wrong close reports
 * success and corrupts the goal-tracking the finish gate reads, which is the worst thing a ledger can do.
 *
 * Three separate defects produced that, and each is refused here:
 *
 *   1. parseInt IS PREFIX-GREEDY. `parseInt("1. Computes + - * / operations...", 10)` is 1, so a TITLE beginning with
 *      a digit resolved as a POSITION (live: run 256f1ad4). A number now has to be the WHOLE string; anything else is
 *      a title, including a title that starts with a digit.
 *
 *   2. A BARE NUMBER MEANS "MY FIRST TASK" TO THE MODEL and "global position 1" to the ledger. adopt() marks goal 1's
 *      tasks carried but never removes them, so position 1 stayed goal 1's work for a whole battery; 39 of the 40 30B
 *      calls sent "1". contextBlock() also hides aged carried tasks while read() keeps numbering globally, so the
 *      model was closing a task it could not even see. A number may therefore no longer address a CARRIED task: that
 *      is refused, and the leftover is named so it can still be closed deliberately BY TITLE if it really is meant.
 *
 *   3. NOTHING CHECKED WHETHER THE TASK WAS ALREADY DONE. Run 7afb8151 closed that task legitimately as its own; all
 *      39 later calls re-closed an already-done task and were told "OK". A no-op reported as success is exactly the
 *      silent-failure shape this repo keeps paying for, so closing a done task is now an error.
 *
 * Ambiguity is REFUSED rather than guessed, and the candidates are listed: guessing the first match is how a
 * substring closed the wrong task. An exact title still wins outright - naming a task in full is the clearest signal
 * a model can send, even when that title is also the prefix of a longer one.
 *
 * Every refusal returns before write(), so a rejected call leaves TASKS.md byte-for-byte unchanged.
 */
export function mark(workspace, which, state) {
  const tasks = read(workspace);
  if (!tasks.length) return { ok: false, error: 'there are no tasks yet' };

  const raw = String(which === null || which === undefined ? '' : which).trim();
  if (!raw) return { ok: false, error: 'say WHICH task - the number task_list shows, or the task title' };

  let i = -1;
  let byNumber = false;

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n < 1 || n > tasks.length) {
      return { ok: false, error: `there is no task ${n} - the ledger has ${tasks.length} task(s)` };
    }
    i = n - 1;
    byNumber = true;
  } else {
    const q = raw.toLowerCase();
    const lower = tasks.map((t) => t.title.toLowerCase());
    let hits = tasks.filter((_, k) => lower[k] === q);
    if (!hits.length) hits = tasks.filter((_, k) => lower[k].startsWith(q));
    if (!hits.length) hits = tasks.filter((_, k) => wordMatch(lower[k], q));
    if (!hits.length) return { ok: false, error: `no task matches "${raw}"` };
    if (hits.length > 1) {
      const names = hits.slice(0, 4).map((t) => `${tasks.indexOf(t) + 1}. ${t.title}`).join(' | ');
      return { ok: false, error: `"${raw}" matches ${hits.length} tasks, so it is ambiguous - name one exactly: ${names}` };
    }
    i = tasks.indexOf(hits[0]);
  }

  const target = tasks[i];
  if (byNumber && target.carried) {
    return { ok: false,
      error: `task ${i + 1} ("${target.title}") is left over from earlier work in this workspace, not part of this goal`
        + ` - its number is not your own first task's number. If you really mean that task, give its title in full;`
        + ` otherwise task_add the work this goal needs` };
  }
  if (state === 'done' && target.state === 'done') {
    return { ok: false, error: `task ${i + 1} ("${target.title}") is already done - closing it again changes nothing` };
  }

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
    // This run's OWN tasks, open or done. adopt() marks every task present when a run starts
    // as carried, so these are exactly the tasks this run itself added or was seeded with.
    own: tasks.filter((t) => !t.carried).length,
  };
}

/**
 * The compact form injected before every model call. Kept small on purpose - it is
 * paid for on every single step, so it must cost tens of tokens, not hundreds.
 * Done items collapse to a count; what is left is what the agent needs to see.
 */
export function contextBlock(workspace, goal = null) {
  const tasks = read(workspace);
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.state === 'done');
  let rest = tasks.filter((t) => t.state !== 'done');
  // Scope leftovers to this goal (see AGED). A caller with no goal gets everything, as before.
  let hidden = 0;
  if (goal) {
    const want = new Set(namedFiles(goal));
    const keep = rest.filter((t) => {
      if (!t.carried) return true;
      const files = namedFiles(t.title);
      if (files.length) return files.some((f) => want.has(f));
      return !t.aged;
    });
    hidden = rest.length - keep.length;
    rest = keep;
  }
  const lines = rest.slice(0, 12).map((t) => {
    const n = tasks.indexOf(t) + 1;
    // Say where a carried task came from. Unlabelled, a model reads another run's
    // leftovers as its own forgotten work: on 2026-09-09 one run planned a task to
    // "mark obsolete parse.js work as intentionally out of scope" for exactly that
    // reason. It needs to know this is context, not an instruction.
    return `  ${t.state === 'doing' ? '>' : ' '} ${n}. ${t.title}${t.carried ? '  (left over from earlier work — only do this if the goal needs it)' : ''}`;
  });
  if (!lines.length) lines.push('  (nothing open for this goal)');
  const more = rest.length > 12 ? `\n  … and ${rest.length - 12} more` : '';
  const off = hidden ? `\n  (${hidden} task(s) left over from earlier goals about other work are not shown - TASKS.md still has them)` : '';
  return `TASK LEDGER (TASKS.md — ${done.length}/${tasks.length} done)\n`
    + `Remaining:\n${lines.join('\n')}${more}${off}\n`
    + `Mark a task done as soon as it works (ACTION: task_done). When every task is done, finish.`;
}

/**
 * Pull a task list out of a BUILD PLAN. The planner is told to emit a numbered list,
 * so numbered lines are the signal; bullets are the fallback for when it does not.
 */
export function fromPlan(planText) {
  const lines = String(planText || '').split(/\r?\n/);
  // Strip markdown emphasis BEFORE anything is matched. The heading skip below was
  // written for "1. SYSTEMS NEEDED" and a real model writes "1. **SYSTEMS NEEDED**", so
  // every section heading was surviving as a work item.
  const clean = (t) => t.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  const isHeading = (l) => /^(?:\d+\.)?\s*[A-Z][A-Z\s/&-]{3,}:?$/.test(clean(l));

  const bulletsIn = (ls) => {
    const out = [];
    for (const raw of ls) {
      const l = clean(raw);
      if (!l || isHeading(l)) continue;
      const m = l.match(/^(?:\d+\.\d+|\d+[.)]|[-*•])\s+(.{4,})$/);
      if (m) out.push(m[1].trim());
    }
    return out;
  };

  // PREFER THE BUILD ORDER SECTION.
  //
  // Every bullet in the plan used to become a ledger task. A game plan has five sections -
  // systems, gameplay loop, state, missing, build order - so a perfectly reasonable plan
  // seeded 29 TASKS, of which only the last handful were things to DO. Measured
  // 2026-09-10 on a live run: "Input system (arrow key handling)" became a task the agent
  // then had to mark complete. With a 30-step budget and a finish gate that wants the
  // ledger closed, that plan was close to unfinishable before a line was written.
  //
  // The plan already tells us which part is work: BUILD ORDER. Take that when present and
  // fall back to every bullet when the model did not use the heading.
  const startIdx = lines.findIndex((l) => /BUILD\s*ORDER/i.test(clean(l)));
  if (startIdx !== -1) {
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (isHeading(lines[i]) && !/BUILD\s*ORDER/i.test(clean(lines[i]))) { endIdx = i; break; }
    }
    const ordered = bulletsIn(lines.slice(startIdx + 1, endIdx));
    if (ordered.length) return ordered.slice(0, 12);
  }
  return bulletsIn(lines).slice(0, 12);
}

/**
 * The files a BUILD PLAN says it will create or change - its FILES section - so the finish
 * gate can ask about one that was never written.
 *
 * The planner is told "2. FILES - the file(s) to create or change, and what each is for", and
 * real 14B plans write it as `2. FILES —` or `2. **FILES**:` followed by backticked names. In
 * the 2026-09-10 data run one plan listed S_QUEUE.md there, the run finished without writing
 * it, and nothing noticed. Game plans use SYSTEMS / BUILD ORDER instead and have no FILES
 * section: that returns [], and the gate stays out of the way.
 *
 * Backticked names are taken when present; bare file names are the fallback. Anything that
 * could point outside the workspace (absolute, drive-letter, `..`, a URL) is dropped.
 */
export function filesFromPlan(planText) {
  const lines = String(planText || '').split(/\r?\n/);
  const clean = (t) => t.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  const HEAD = /^(?:\d+[.)]\s*)?FILES\b/i;
  const start = lines.findIndex((l) => HEAD.test(clean(l)));
  if (start === -1) return [];
  const section = [clean(lines[start]).replace(HEAD, '')];
  for (let i = start + 1; i < lines.length; i++) {
    const l = clean(lines[i]);
    if (/^\d+[.)]\s*\S/.test(l)) break;                  // the next numbered section
    section.push(l);
  }
  const text = section.join('\n');
  const ticked = [...text.matchAll(/`([^`\s]+\.[A-Za-z0-9]{1,6})`/g)].map((m) => m[1]);
  const names = ticked.length ? ticked
    : [...text.matchAll(/(?:^|[\s(])([\w][\w./-]*\.(?:m?js|cjs|ts|py|html?|css|json|md|txt|gd|tscn))\b/g)].map((m) => m[1]);
  const safe = names.filter((f) => !/^(?:[/\\]|[A-Za-z]:)/.test(f) && !f.split(/[/\\]/).includes('..') && !f.includes('://'));
  return [...new Set(safe)].slice(0, 12);
}
