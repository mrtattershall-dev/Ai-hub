# Audit 07 — the run lifecycle: checkpoints, rollback, the finish gate, verify_project, the ledger

READ-ONLY audit, 2026-09-12. Serving tree `ai-coding-hub-indent` @ `3d7a080`.
Live evidence: `trial35-Cq4RcJ` (14B), `trial35-cWxzHB` (MoE), `trial35-8XrYOc` (dense) — 50 run records,
1,012 steps, 221 workspace commits, read while the three paid windows were running. Nothing was modified.

Bias of this audit, as instructed: toward finding lost work.

---

## Headline

Two findings are load-bearing.

1. **The finish gate can be satisfied by a file the run never touched.** Live run `8e7cf9aa` (Cq4RcJ) is recorded
   `done` / `finishKind: verified` for a goal that asked for two new methods, having landed **zero** writes. Proven
   below from four independent sources. This is the mechanism behind "goals marked done that score zero".
2. **The rollback bound has a second path, and it is the unbounded one.** The set-E fix holds for writes made
   through `write_file`/`edit_file`/`append_file`. Files changed by `run_command`, `run_python` or a **sub-task**
   are invisible to the predicate that selects the bound, so such a run takes the `fileHistory()` branch that
   reaches back past its own goal.

---

## A. CHECKPOINTS

### When one is taken

`agent.js:3158-3182`, inside the per-action loop, before the tool executes:

```js
const MUTATING = new Set(['write_file', 'append_file', 'edit_file', 'run_command', 'run_python', 'download_file', 'spawn_subtask']);
if (MUTATING.has(tool)) {
  try {
    await ensureRepo(WORKSPACE);
    if (await isDirty(WORKSPACE)) {
      const cp = await commitAll(WORKSPACE, `before ${tool}: ${(thought || '').slice(0, 80)}`);
      if (cp.ok && cp.sha) pushStep(run, { type: 'checkpoint', text: `checkpoint ${cp.sha}` });
```

### What it contains

`commitAll` (`workspaceGit.js:119-141`) runs `add -A --ignore-errors` over the **whole workspace** and commits.
So a checkpoint is the entire tree as it stood *before* the tool ran — not a per-file diff, and not the result of
the write it precedes. Checkpoint N contains the damage of write N-1. The end-of-run repair depends on exactly
this and says so (`agent.js:3822-3827`).

Three hardenings are real and hold: `GIT_CEILING_DIRECTORIES` plus `ownRepoOrNull()` stop git escaping into the
hub's own tree; `clearStaleLock()` clears an `index.lock` older than 60 s; `--ignore-errors` keeps one unaddable
filename from ending the whole undo history. A checkpoint failure is surfaced once per distinct problem
(`agent.js:3177-3179`).

Live: checkpoint counts track mutating steps closely (Cq4RcJ 73 commits, cWxzHB 59, 8XrYOc 89) and no run
recorded a `checkpointProblem`. The ordinary path is working.

### Write paths that change a file with NO checkpoint

**A1. Sub-task writes (the significant one).** `runSubtask` (`agent.js:2685-2757`) runs its own loop and calls
`tools[tool](args)` at line 2744 with no `ensureRepo`/`commitAll` anywhere. The parent checkpoints once, before
`spawn_subtask`. The code argues this is the right granularity ("you undo the sub-task, not step 6 of it"), and
as an undo story that is defensible — but it interacts badly with B below, and the sub-task's step record keeps
`tool` and `args` while **discarding the result** (`pushStep(parent, { type: 'subtask_step', tool, args, text })`),
so the parent's record can never show what a delegated write actually did.

**A2. The approve route.** `agent.js:4627-4650` executes `tools[tool](args)` directly with no checkpoint. For
`run_command` / `run_python` / `download_file` this is covered, because the main loop already checkpointed before
parking the run. It is **not** covered for `git_undo` and `git_commit`, which are in neither `MUTATING` nor
`AUTO_TOOLS` and therefore always arrive here. `git_undo({hard:true})` performs `git reset --hard`
(`workspaceGit.js:228-231`), discarding commits and uncommitted work with no restore point taken first.
Mitigated in practice: an unattended run DENIES anything needing a human (`agent.js:3413`), so this cannot fire in
the trial arms. It is live for an attended run.

**A3. The hub writes into the agent's workspace itself.** `run_python` writes the model's inline code to
`WORKSPACE/_snippet.py` (`agent.js:1139`). It is checkpointed (run_python is MUTATING), but it is a **hub-authored
file inside the graded workspace**, and it is swept by `verifyProject`'s syntax check and by the end-of-run repair
like any model file. Live consequence, cWxzHB run `66fb8638`: `unrepairedFiles: ["_snippet.py"]`, and TASKS.md now
carries `Fix _snippet.py - it does not parse, and the end-of-run repair refused to reach back past this goal`.
`_snippet.py` parses today. Every later goal in that workspace inherits a permanent false task describing the
hub's own scratch file as unfinished agent work.

**A4. By design, not a defect but worth stating:** when the tree is clean the checkpoint is a no-op and **no
checkpoint step is recorded**, so a run's first landed write has no floor commit of its own. The repair
compensates for exactly this (`agent.js:3845-3853`); it is the reason the `landedWrites` predicate exists.

---

## B. ROLLBACK

### Conditions

End-of-run repair, `agent.js:3798-3912`, in `drive()`'s `finally`, for `status ∈ {done, error, stopped}`, with
`run.busy` deliberately still true so the workspace stays locked while files are rewritten (`agent.js:3779-3786`).
For each top-level file matching `/\.(c|m)?js$|\.py$/` that fails `quickCheck`, it walks candidate commits newest
first, installs the first version that parses, and reverts if none does.

**Scope limit worth recording:** `readdirSync(WORKSPACE)` is not recursive and is capped at 40 files
(`agent.js:3813-3814`). A broken file in a subdirectory is never repaired and never reported.

### The bound, and whether it can reach past the current goal

```js
const floorSha = ownShas[0] || null;   // agent.js:3811
const landedWrites = (run.steps || []).filter((s) => s.type === 'tool'
  && /^(write_file|edit_file|append_file)$/.test(String(s.tool))
  && /^OK/.test(String(s.result || ''))).length;
const candidates = landedWrites
  ? (floorSha ? await fileHistorySince(WORKSPACE, f, `${floorSha}^`, 25).catch(() => []) : [])
  : await fileHistory(WORKSPACE, f, 25).catch(() => []);        // agent.js:3854-3859
```

**The fix holds where it applies.** `fileHistorySince` (`workspaceGit.js:201-211`) asks git for ancestry
(`<since>..HEAD -- <file>`) rather than slicing an index, and returns `[]` on a missing or malformed floor —
fail-closed, "no usable floor means no candidates, never everything". The `^` parent form is accepted by the
regex. With `landedWrites > 0` and no floor, candidates are `[]` and nothing is restored. I could not construct a
path where this branch reaches past the goal.

**There is a second path, and it is unbounded.** When `landedWrites === 0` the code calls `fileHistory(..., 25)` —
the file's whole history, which the code's own set-E measurement says "reaches 9-12 GOALS back on exactly the
long-lived files that matter". The justification (`agent.js:3841-3848`) is that a run with no landed write "has
nothing of its own to lose". That predicate is narrower than the claim:

- **Writes via `run_command` / `run_python` are not counted.** A run whose model builds a file with
  `node build.js`, a shell redirect, or a python script that writes output has `landedWrites === 0` while having
  changed the tree.
- **Writes inside a sub-task are not counted.** They are recorded as `type: 'subtask_step'`, and the predicate
  filters `s.type === 'tool'`. A run that delegates all its work has `landedWrites === 0`.

Live instance of the precondition in a real paid run: Cq4RcJ `8e7cf9aa` ended with 4 write attempts, **0**
matching `/^OK/`, having run `npm install` (which rewrote `package-lock.json`). Had any top-level `.js` failed to
parse at its end, the repair would have taken the unbounded branch. The bug of this shape was fixed for the
*index-slicing* path; the *predicate* that chooses between bounded and unbounded still has the hole.

Note the predicate is correct about `NO CHANGE:` and `ERROR:` results — those genuinely land nothing, including
the duplicate-definition guard's restore-and-refuse at `agent.js:3535`. The hole is only the two paths above.

### When no parsing version exists

Handled and recorded (`agent.js:3884-3894`): the file is left exactly as the run left it, `run.repairRefused` is
set, an `error` step is pushed ("...rather than reaching back past this goal. This run did not finish cleanly"),
and a `Fix <file>` task is added to the ledger. The refusal is then committed with its own message so the next
goal's checkpoint cannot absorb it (`agent.js:3906-3909`).

**Live, and this is the real cost of a correct refusal:** Cq4RcJ's `test_s3_matrix.js` was recorded unrepaired by
**four separate runs** (`38429517`, `47f510ad`, `7931f7a0`, `ce597440`) and does not parse on disk right now. Each
of those runs ended `stopped`. One run (`38429517`) both restored `s4_markdown.py` from `910e1b6` (removing
nothing) and refused `test_s3_matrix.js` in the same teardown. The refusal is the right call; the inherited
wreckage is now visible instead of silent, which is the improvement — but the wreckage is still there and, per D
below, it is workspace-wide input to the next goal's verifier.

`git_undo` (`agent.js:950-966`) is the only other restore path. It commits a dirty tree first so a revert cannot
fail, and it preserves TASKS.md / NOTES.md / ESCALATIONS.md across the undo. No third path exists: `showFile` /
`fileHistory*` / `reset` appear only in `agent.js` and `workspaceGit.js`.

---

## C. THE FINISH GATE

### Every path to `status = 'done'`

| # | Site | Gate entered? |
|---|---|---|
| 1 | `agent.js:3372` — the `finish` tool after the gate | yes |
| 2 | `agent.js:3750` — test_web auto-finish on 3 clean tests, `break turn` from inside the tool handler | **no gate at all** |
| 3 | `agent.js:2724` — a sub-task's own `finish` | n/a (not a top-level run record) |

`queue.js:193` / `agent.js:3966` only propagate an already-decided status.

### Every finish verdict

`finishVerdicts.mjs` + `finishVerdict()` (`agent.js:2612-2618`):

```js
function finishVerdict(run) {
  if (run.status !== 'done') return 'not_finished';
  if (run.finishKind) return run.finishKind;
  if (run.verified) return 'verified';
  if (run.sawScreen) return 'screen_checked';
  return 'unverified';
}
```

`verified` · `screen_checked` · `forced` · `auto_clean_tests` · `unverified` · `not_finished`, with
`UNVERIFIED = {forced, auto_clean_tests, unverified}` and absent-means-unknown. That contract is sound.

**But only two of the six are ever stamped on the run.** `forced` (3369) and `auto_clean_tests` (3747) are
written to `run.finishKind`; the rest are *inferred at index/trace write time* from `run.verified` / `run.sawScreen`.
Live: 33 of 35 `done` run JSONs carry no `finishKind` at all, while `index.jsonl` carries the full verdict for
every one. Anyone reading run files directly (a replay rig, a corpus builder that reads `runs/`) sees a bare
`"status":"done"`. The two durable records are correct; the run file is not self-describing.

Live verdict distribution (`index.jsonl`): Cq4RcJ 6 verified / 1 auto_clean_tests / 8 not_finished;
cWxzHB 14 verified / 1 screen_checked / 2 not_finished; 8XrYOc 11 verified / 1 screen_checked / 3 not_finished.
Zero `forced` in this set — the 3-block cap did not fire.

### Can a run be `done` while its own project does not run? Yes — five ways

**C1. Route 2, live.** Cq4RcJ `a92a2637` — 10 steps: two `write_file`, three identical `test_web` passes, then
auto-finish. `finishKind: auto_clean_tests`. The ledger gate, the plan-FILES gate, the visual check and the
runtime verifier never ran. The hub labels this honestly and the note is explicit, but the run is `done`.

**C2. Route 1, forced.** After 3 blocks the gate steps aside and `run.status = 'done'` regardless
(`agent.js:3365-3372`). Honest label, `done` status.

**C3. A throwing verifier passes the gate.** The whole verification block is wrapped in
`} catch { /* verification is evidence, not a gate that can hang a run */ }` (`agent.js:3358`). If
`verifier.verify()` throws — spawn failure, unreadable workspace — control falls straight through to
`run.status = 'done'`. The verdict then reads `unverified` rather than `verified`, so it is recorded honestly, but
nothing blocks.

**C4. The plan-FILES gate asks once and then waves the run through** (`agent.js:3258-3262`): a second `finish`
with the file still missing is accepted with a note. Deliberate, documented, still a way to finish incomplete.

**C5 — the important one: the gate is satisfied by a file the run never touched.** See below.

### C5 in full: run `8e7cf9aa`, Cq4RcJ — `done` / `verified`, zero work landed

Goal: *"Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js …"*

Recorded outcome: `status: done`, `run.verified: true`, `index.jsonl → finishKind: "verified"`, finish summary
*"Added `checkout(isbn, member)` and `available(isbn)` … Verified functionality using `test_s1_library.js`."*

What actually happened, from the run's own 21 steps:

| step | tool | result |
|---|---|---|
| 5 | edit_file s1_library.js | `ERROR: … would have DUPLICATED 1 definition(s) … UNCHANGED - nothing was written` |
| 6,7,8 | edit_file s1_library.js | `ERROR: the FIND snippet was not found in s1_library.js (26 lines)` |
| 10,14 | run_command | `ReferenceError: describe is not defined` |
| 12,16 | run_command | `npm install` → EXIT 0 |
| 18 | run_command | mocha: all green |
| 20 | note | `Verified (node): all 13 source file(s) pass a syntax check; \`node s1_library.js\` ran and exited cleanly` |

Four independent confirmations that nothing landed:

1. Run record: 4 write attempts, **0** with an `OK` result.
2. The run's only checkpoint, `91074d1`, changed `ESCALATIONS.md | 6 ++++++` — one file, not `s1_library.js`.
3. `git log -- s1_library.js` in that workspace: the last commit touching it is `f521257` at **06:36:39**; the run
   ran 06:38:00-06:39:06. **No commit touched the goal's file during the run.**
4. `s1_library.js` on disk today has exactly `constructor, addBook, copies, titles` — no `checkout`, no
   `available`. The mocha suite that went green (`test_s1_library.js`) contains **zero** occurrences of
   `checkout` or `available`; it tests addBook/copies/titles only.

So the model's own test passed because it tested the old methods, and the gate's runtime verifier passed because
`node s1_library.js` loads a syntactically valid file. Neither asked whether the goal's deliverable exists. This is
a `done`/`verified` run that would score 0 on any hidden check of `checkout`/`available` — precisely the observed
"goals marked done that score zero".

---

## D. verify_project — what it verifies, and where it decides

**It gates.** Two callers, and the distinction matters:

- **Advisory:** the `verify_project` tool (`agent.js:1437-1443`) — the model asks, gets prose.
- **Deciding:** the finish gate calls `verifier.verify()` directly (`agent.js:3338-3356`) and a `!v.ok` blocks.

The set-E entry bug was fixed on **both** paths — the gate now resolves `goalEntry` the same way the tool does
(`agent.js:3345`, with the comment naming the "deciding path kept the bug the advisory path had fixed" lesson).
That drift is closed. `run.verified` is additionally keyed to `workspaceStamp()` (`agent.js:3309`, `323-338`:
path+size+mtime of every source file), so a pass cannot be re-used after the tree changes. Both are good.

**What a pass actually proves** (`verifyProject.js:142-259`): a syntax sweep of at most 80 files, plus exactly one
of `npm test` / `node <entry>` / `pytest` / `python <entry>` / `godot --check-only` / nothing.

How a self-check passes while the project is broken — six mechanisms, four of them live in this data:

1. **Exit 0 means "the module loaded", not "the goal works".** `node s1_library.js` on a library file with no
   top-level assertions exits 0 whatever is missing. Live: C5 above, and the same shape in the "Verified" notes of
   `b708926d`, `4972679a`, `9c972bc9`, `fb00b2dc` — all `ran and exited cleanly` with no assertion output.
2. **A caught-and-printed error still exits 0.** Live, Cq4RcJ `27a9ee1c`:
   `Verified (python): … \`python s2_logs.py\` ran and exited cleanly — output: ValueError: Line does not match the expected format`.
   The verifier recorded a ValueError in its own evidence line and called it verification.
3. **A timeout is counted as success** (`verifyProject.js:205, 225`) — correct for a server, but an infinite loop
   verifies.
4. **`kind: 'unknown'` returns `ok: true`** with the evidence string "no recognisable project type - nothing could
   be executed to prove this works" (`verifyProject.js:258-259`). The gate reads `ok`, not the prose.
5. **Godot with no binary returns `ok: true`** and the word UNVERIFIED in prose only (`verifyProject.js:240`).
6. **`kind: 'web'` returns `ok` as soon as `index.html` exists** (`verifyProject.js:171-173`).

And the inverse hazard, which is active in these workspaces: the syntax sweep is **workspace-wide**, so an
unrelated broken leftover fails the gate for a goal that is itself correct. Cq4RcJ is carrying exactly such a file
(`test_s3_matrix.js`, unparseable, refused by four runs). Any later node/python goal in that workspace gets
`N of M source file(s) do not compile` and is blocked up to three times, then force-finished. No forced finish
appears in this set, but the loaded gun is in the workspace.

---

## E. TASK LEDGER

**Creation.** `seed()` from the BUILD PLAN (≤40 items, stamped `<!-- seeded-from-plan -->`); `add()` appends, and
the first `task_add` against a still-pristine plan-seeded ledger **replaces** it (`taskLedger.js:194-204`) —
the documented fix for double-seeding. Cap 60, evicting completed tasks oldest-first and warning out loud when
pending work is dropped. Writes are atomic via tmp+rename with a direct-write fallback.

**Carrying.** `adopt()` (`taskLedger.js:140-159`) marks *every* task present at run start `carried` (done ones
included — the fix for the "ALL 3 TASKS COMPLETE" miscount), and a second run start adds `aged`. `contextBlock`
scopes carried tasks to the goal by filename so stale items drop out of the per-call block while staying in
TASKS.md. `progress()` exposes `remainingOwn`, and the finish gate holds the run only to non-carried tasks
(`agent.js:3236`). This layer is careful and it works.

**Matching — this is where the refusal is missing.** `mark()` (`taskLedger.js:234-251`):

```js
const n = parseInt(which, 10);
if (!Number.isNaN(n) && n >= 1 && n <= tasks.length) i = n - 1;
else {
  const q = String(which || '').toLowerCase().trim();
  if (q) i = tasks.findIndex((t) => t.title.toLowerCase().includes(q));
}
if (i < 0) return { ok: false, error: `no task matches "${which}"` };
```

- The numeric index addresses the **whole list, carried and aged included** — `which: "1"` reaches another goal's
  leftover.
- The fallback is a case-insensitive **substring** match, first hit wins, across carried, aged and already-done
  tasks alike.
- There is **no scope check and no refusal**. The only failure mode is "no task matches".

**The mismatch is detected, announced, and then proceeds.** `task_done` (`agent.js:1367-1385`):

```js
if (r.task.carried) {
  …
  return `OK: "${r.task.title}" done - that task was LEFT OVER from earlier work in this workspace, not part of this goal. ${own}`;
}
```

It knows the task belongs to a different goal, says so, returns `OK`, and the task is marked `[x]`. That is
exactly the behaviour reported.

**Live: 12 occurrences across the three arms, every one `{"which":"1"}`.** In cWxzHB, **ten separate runs** each
closed the same carried task — *"HOW TO VERIFY: Run `node s1_library.js` and check that all asserts pass"* — a
leftover from the first goal. `mark()` re-marks an already-done task without complaint and the file records only
state, never who closed it, so the same leftover can be "completed" once per run forever. `8e7cf9aa`'s sibling
`26bfb85d` did the same in Cq4RcJ; `ee180f39` in 8XrYOc.

The gate is not fooled (closing a carried task does not change `remainingOwn`), so the damage is not a false
finish — it is that the model's only remaining instruction at that point is prose: *"This goal has no tasks of its
own on the ledger - before you finish, check its deliverables yourself."*

**A feedback loop worth naming:** the end-of-run repair writes tasks *into* the ledger (`Fix <f> …`,
`Re-add <defs> to <f> …`, `agent.js:3877, 3891`). The next run adopts them as carried, and can then close them
with `which: "1"` without doing the work. Live: Cq4RcJ TASKS.md item 9 is a repair-authored `Fix test_s3_matrix.js`
task; cWxzHB item 2 is the `Fix _snippet.py` task for the hub's own scratch file.

---

## F. RUN RECORDS

**Ordering and completeness: clean.** `pushStep` (`agent.js:2129-2131`) appends with a monotonic `n` and `ts`;
`persist()` rewrites the whole file after every completed step (`agent.js:3757`). Measured across all three live
arms: 1,012 steps, **0** `n` mismatches, **0** timestamp inversions, **0** truncated `args` on disk. Steps are not
reordered and are not lost.

**What is trimmed, and where:**

- `slimForDisk` truncates any step `arg` string over 30,000 chars *on disk only*, matched deliberately to what the
  trace harvester keeps (`agent.js:2145-2171`). Not triggered in this data.
- `evictOldRuns` (40) drops runs from **memory only** — the comment records the previous bug where it also
  unlinked files and lost goals 1-32 of a set-D run.
- `reapRuns` (300) deletes the oldest run **files and their transcripts together** (`agent.js:2184-2185`). That is
  the one place evidence is genuinely destroyed at scale: past 300 runs, both the record and its untrimmed
  transcript go.

**`run.history` is pruned destructively and the mitigation is real.** `pruneHistory` (`agent.js:2336-2409`)
rewrites `run.history` in place, keeping marker-anchored head messages (system / GOAL / notes / BUILD PLAN, each
capped at `budget/3`) plus a token-bounded tail, and inserting a "(… N earlier steps trimmed)" marker. Evidence
survives because `appendTranscript` (`agent.js:2216-2222`) writes every model call's `sent` + **full untrimmed
`reply`** to `<id>.transcript.jsonl` — the loop never reads it back.

**Verified untrimmed against live data:** transcript lines = `modelCalls` + 1 (the plan call) for every run
sampled. The decisive case is 8XrYOc `153f5c99`: **31 transcript lines for 30 model calls**, while its
`run.history` holds only **18** messages — the transcript demonstrably retains calls the pruned history has
dropped. Max reply lengths (1.7k-3.4k chars) show no truncation. Sub-task calls are written to the *parent's*
transcript with `kind: 'subtask'` (`agent.js:2714`), so delegated model output is preserved even though the
parent's step record keeps no result.

---

## G. Disk vs. run record

**Written to disk, not reflected in the record:**

1. **Sub-task writes** — the parent records `subtask_step` with `tool` and `args` but **no result**
   (`agent.js:2745`), so the record cannot show whether the write landed. The trace *does* capture the content
   (`saveTrace` filters on `s.tool`, which these steps carry), but the repair's `landedWrites` predicate filters on
   `s.type === 'tool'` and therefore misses them — see B.
2. **Anything a command writes.** `run_command` / `run_python` side effects appear in git and on disk but in no
   step of their own. `_snippet.py` is written by the hub itself (`agent.js:1139`) with no step at all.
3. **Timing, structurally.** A checkpoint commits the state *before* a write, so a run's last landed write is
   committed only by the next run's checkpoint or by the end-of-run repair commit. The code fixes the attribution
   half of this by committing the repair explicitly (`agent.js:3906`, "the next goal's checkpoint absorbs the
   change and runstates.mjs attributes it to that goal instead of this one").

**Recorded but not on disk:** I found no path where a step claims `OK` while nothing landed. The write guards
compare against `beforeSrc` and rewrite the result honestly — the duplicate guard restores the file and replaces
its own result with `ERROR:` (`agent.js:3535-3546`), and `NO CHANGE:` results are explicit. The C5 run is the
inverse and is correctly recorded at step level: every failed edit says `ERROR`. **The dishonesty in C5 is not in
the steps — it is in the verdict computed from them.**

---

## Summary

### Where work can be lost

1. **Unbounded rollback when the write predicate misses.** `landedWrites` counts only `type:'tool'`
   write/edit/append steps with an `OK` result, so a run that changed files via `run_command`, `run_python` or a
   sub-task takes `fileHistory(..., 25)` and can install a version from an earlier goal (`agent.js:3854-3859`).
   The set-E fix closed the index-slicing hole; this is the predicate hole behind it. Precondition observed live
   (`8e7cf9aa`: 0 OK writes, tree changed by `npm install`).
2. **Sub-task: N writes, one restore point**, and no per-write record of what landed (`agent.js:2744-2745`).
3. **`git_undo({hard:true})` executes from the approve route with no checkpoint** and discards commits
   (`agent.js:4644` → `workspaceGit.js:228`). Human-gated; denied when unattended.
4. **A refused repair leaves broken code that poisons every later goal in the workspace.** Live: Cq4RcJ's
   `test_s3_matrix.js`, unparseable now, recorded unrepaired by four runs — and `verifyProject`'s sweep is
   workspace-wide, so it is input to every later goal's gate.
5. **Subdirectories are never repaired** — the repair reads only the workspace root, first 40 files.
6. **At 300 runs, a run file and its transcript are deleted together** (`agent.js:2184-2185`).

### How a broken run gets marked `done`

1. **The runtime verifier passes on a file the run never touched** — `done`/`verified` with zero work landed.
   Proven four ways on live run `8e7cf9aa`. This is the "done but scores zero" mechanism, and it is the one that
   is *not* honestly labelled: the other routes stamp an UNVERIFIED verdict, this one stamps `verified`.
2. **`auto_clean_tests`** — finishes from inside the `test_web` handler, entering no gate at all
   (`agent.js:3747-3751`). Live: `a92a2637`.
3. **`forced`** — after 3 blocks the gate steps aside and the status is still `done` (`agent.js:3365-3372`).
4. **A throwing verifier** falls through the `catch` at `agent.js:3358` straight to `done`.
5. **Exit-code-0 proofs**: a module that merely loads, a caught-and-printed exception (live: `27a9ee1c` recorded a
   `ValueError` inside its own "Verified" evidence), a timeout counted as success, `kind:'unknown'`, Godot with no
   binary, and `kind:'web'` needing only that `index.html` exists.

### What is working and should not be disturbed

The ancestry-based bound in `fileHistorySince`, fail-closed on a missing floor; the `workspaceStamp` re-arming of
`run.verified`; the gate/tool entry-resolution parity; atomic ledger writes and carried/aged scoping; untrimmed
transcripts (measurably retaining what pruning drops); step ordering and persistence; and the honest `forced` /
`auto_clean_tests` stamping in the two durable records.
