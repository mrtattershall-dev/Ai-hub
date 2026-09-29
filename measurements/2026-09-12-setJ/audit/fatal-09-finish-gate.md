# FATAL-09 — the finish gate: every route by which a run ends, and whether it ended at the right moment

READ-ONLY audit. Source: `ai-coding-hub-indent/server/{agent.js, verifyProject.js, taskLedger.js}`.
Records: all 1,004 run JSONs under `measurements/*/`, of which **583 join to an authoritative per-goal
checker verdict** (`<arm>-rows.json` gives `runId → goal n`; `<arm>-checks.json` gives that goal's
`asIs` PASS/fail). Every "scored" number below is the checker, not a proxy.

> **Two caveats stated up front.** (1) The checker scores the **final** workspace, so a goal can be
> marked PASS by work a *later* run left on disk. (2) `rows.json.good` is a heuristic and disagrees
> with the checker in **177 of 583** cases (74 good-only, 103 checker-only) — it is used below only
> where labelled, never as the score.

---

## A. Every finish route, paired with its scored outcome

### The routes, in source

| # | Route | Site | Recorded as |
|---|---|---|---|
| 1 | Finish gate satisfied | `agent.js:3383` `run.status='done'` | `verified` / `screen_checked` / `unverified` |
| 2 | **Forced** — gate blocked 3×, steps aside | `agent.js:3376-3381` | `forced` |
| 3 | **auto_clean_tests** — finishes *inside* the `test_web` handler | `agent.js:3769-3778` | `auto_clean_tests` |
| 4 | Budget exhausted (30 calls / 8 min) | `agent.js:3798-3801` | `stopped` |
| 5 | Loop guard — 3 identical replies | `agent.js:3069` | `stopped` |
| 6 | Loop guard — identical tool answer | same site, different message | `stopped` |
| 7 | Parse give-up (5 of last 10 unparseable) | `agent.js:3099` | `error` |
| 8 | Same web error ×4 | `agent.js:3750` | `stopped` |
| 9 | Model unreachable / Stop pressed | `agent.js:2247, 2945, 3008` | `interrupted` |
| 10 | Parked for approval | `agent.js:3432` | `awaiting_approval` |

Route 3 is a genuine bypass and says so in its own comment: *"no ledger gate, no plan-FILES gate, no
re-test gate, no visual check, no runtime verifier."* Route 9 is invisible in the forever record —
`recordRunIndex` fires only for `done|error|stopped`, so setJ's 14B has 16 run files and 15 index rows.

### Route × scored outcome (583 runs with a checker verdict)

| Finish route | runs | scored PASS | rate |
|---|---:|---:|---:|
| `verified` | 187 | 111 | **59%** |
| `DIED:loop_reply` | 141 | 9 | **6%** |
| `DIED:budget` | 116 | 29 | 25% |
| `DIED:repair_refused` | 57 | 15 | 26% |
| `screen_checked` | 25 | 12 | 48% |
| `DIED:loop_toolrepeat` | 22 | 0 | **0%** |
| `unverified` | 18 | 10 | 56% |
| `DIED:model_unreachable` | 6 | 0 | 0% |
| `DIED:rolled_back` | 5 | 1 | 20% |
| `auto_clean_tests` | 3 | 2 | 67% |
| other (`interrupted`, `running`, `error`) | 3 | 0 | 0% |

**Routes that correlate with failure:** the two loop-guard routes (163 runs, 9 PASS, **6%**) and
`model_unreachable`. Budget death is *not* the worst route — at 25% it beats `repair_refused` and is
four times better than the loop guard. **The gate itself is not where goals are lost; 350 of 583 runs
never reach it at all.**

**`forced` never appears in this table.** 14 runs archive-wide carry `forcedFinish: true`, all with
`finishBlocks: 3` — and all 14 have `finishKind: undefined`, so `finishVerdict()` (`agent.js:2623`)
records them as `unverified`. They predate the `finishKind` stamp; on the setJ tree the stamp is set
at `agent.js:3380`, and no setJ/setI run was forced. Historical mislabel, not a live defect.

---

## B. Finished too early — `done` while the goal was incomplete

**76 of 187 verified finishes (41%) scored FAIL.** What the gate accepted as proof:

| Evidence the gate accepted | finishes | scored FAIL |
|---|---:|---:|
| bare loadability — "ran and exited cleanly", **no program output** | 146 | 61 (42%) |
| proof carried actual program output | 41 | 15 (37%) |

The gate's branch 4 (`agent.js:3320-3366`) asks `verifyProject.verify()` one question — *does this
run?* For a library module, `node s1_library.js` exits 0 because the module loads. It exits 0 whether
or not the goal was done. **146 of 187 verified finishes rest on that.**

### The established case, confirmed: `8e7cf9aa` (setJ, 14B, goal 11)

Goal: *"Add checkout(isbn, member) and available(isbn) to the EXISTING Library in s1_library.js."*
All four `edit_file` calls returned ERROR; **zero writes landed anywhere in the run**:

```
edit_file s1_library.js -> ERROR: this edit_file would have DUPLICATED 1 definition(s) ... addBook (1 -> 2)
edit_file s1_library.js -> ERROR: the FIND snippet was not found in s1_library.js (26 lines)
edit_file s1_library.js -> ERROR: the FIND snippet was not found in s1_library.js (26 lines)
edit_file s1_library.js -> ERROR: the FIND snippet was not found in s1_library.js (26 lines)
```

The evidence the gate accepted, verbatim from the run's own note step:

```
Verified (node): all 13 source file(s) pass a syntax check; `node s1_library.js` ran and exited cleanly
```

`rows.json` for that goal reads `s1_library.js:runs FN-MISSING(checkout,available)`; the checker says
`threw: l.checkout is not a function`. The file was the one the goal named, it loaded, and it did not
contain the goal.

**Archive-wide, exactly 2 verified finishes had zero landed writes on the goal's target file — and
both scored FAIL** (`8e7cf9aa`, setJ goal 11; `72d91b63`, setH goal 40, `s10_desk.js`). This is a
narrow class, and it is cheap and safe to catch.

**What would have caught it.** The run landed no write at all. A gate that refuses to stamp `verified`
when the run produced **zero successful mutations** costs nothing — a run that changed nothing cannot
have completed a "create"/"add" goal. Broader: of the 76 verified-but-failed finishes, **44 show
`FN-MISSING` on disk** (the file loads, the named functions are absent). Treat 44 as a loose upper
bound only — `FN-MISSING` over-fires badly, extracting prose words as symbols (setJ goal 1 reports
`FN-MISSING(book,owns)` for a goal the checker PASSED).

---

## C. Blocked too long — the gate refused and the run then died

65 verifier-block instructions were issued archive-wide. 59 blocked runs have a checker verdict:
**21 recovered and finished; 40 blocked runs died.** Of those 40, **14 ultimately scored PASS**.

**A block that kills a run does not automatically lose the score** — the run's writes stay on disk, so
the feature can still be present at scoring time. The measured cost of a block that is never satisfied
is therefore budget and risk, not automatic loss:

- **11.3 tool calls** spent on average after the first block (451 across the 40 runs)
- **3.3 landed writes** on average after the first block — the model editing code that was already right
- **5** of the 40 ended in an end-of-run rollback, **6** in `repair refused: left unparseable`

### Was the block correct each time?

| What the block blamed | runs | of which the goal also scored FAIL |
|---|---:|---:|
| **only file(s) other than the goal's** | 15 | 6 |
| the goal's own file | 3 | 3 |
| unknown (the instruction was pruned from history) | 22 | 15 |

The three blocks grounded in the goal's own file were correct and the goals failed. The **15 grounded
only in unrelated files were wrong in the sense that matters** — the gate had already proved the
goal's own file good, in the same breath. Verbatim, from `c9d397f0` (setH, goal *"Add keys() to the
EXISTING Cache in s7_cache.js"*, scored PASS, killed at call 11):

```
Do NOT finish yet — the project does not run: PROJECT VERIFICATION (detected: node)
  ✅ `node s7_cache.js` ran and exited cleanly
  ❌ 2 of 14 source file(s) do not compile:
     s1_library.js: ... loans(member) { ^
     s4_markdown.py: Sorry: IndentationError: unexpected ...
```

`2bd909f6` is the same shape, same two innocent bystanders. `0e8bb2da` was blocked by `_snippet.py`, a
throwaway debug file from an earlier goal that contained JavaScript.

**What the model should have been told instead.** Not *"the project does not run"* — it does. The
honest instruction is: *"Your file `s7_cache.js` runs and exited cleanly; the goal looks done. Two
files left over from earlier goals do not compile (`s1_library.js`, `s4_markdown.py`). They are not
yours to fix — finish now and they will be recorded as pre-existing damage."* That converts a fatal
block into a note.

### The 3-strike escape hatch mostly works, and sometimes doesn't

19 runs reached 3 blocks; **16 took the forced exit, 3 died at 3 blocks** — because the hatch opens
only when the model calls `finish` a *fourth* time, and those three never did.

---

## D. `verifyProject.verify()` and its one entry file

`agent.js:3355`:

```js
const goalEntry = ledger.namedFiles(run.goal || '').find((f) => /\.(py|c?js|mjs)$/i.test(f) && existsSync(join(WORKSPACE, f)));
const v = await verifier.verify(WORKSPACE, { entry: goalEntry });
```

**The entry fix worked.** Verified runs whose executed file differs from the goal's target file:

| set | verified notes | **wrong file** | right file |
|---|---:|---:|---:|
| 2026-09-10-14b-30min | 15 | 12 | 3 |
| 2026-09-10-14b-rerun | 20 | 15 | 4 |
| 2026-09-10-14b-vs-32b | 43 | 32 | 9 |
| 2026-09-11-coder3 | 30 | 24 | 4 |
| 2026-09-11-setC | 45 | 40 | 5 |
| 2026-09-11-setD | 53 | 50 | 2 |
| 2026-09-11-setE | 63 | 53 | 10 |
| **2026-09-11-setG** | 26 | **0** | 26 |
| **2026-09-12-setH** | 54 | **0** | 46 |
| **2026-09-12-setI** | 11 | **0** | 11 |
| **2026-09-12-setJ** | 33 | **0** | 33 |

228 wrong-file verifications, **every one of them before setG**. Pre-fix, a goal about `s9_validate.js`
was passed on the strength of `node s1_stack.js`. Post-fix: zero. Do not re-fix this.

**What the entry does NOT reach — three live paths where the gate still judges the wrong file:**

1. **The syntax sweep ignores the entry entirely.** `verifyProject.js:159-162` sweeps *every* file in
   the workspace and pushes a problem; `ok: !problems.length` (`:210`). One unparseable leftover
   blocks every later goal. Measured: **23 blocks grounded in a file other than the goal's**, and it
   is the mechanism behind the whole `unrelatedOnly` column in section C.
2. **The pytest branch ignores the entry.** `verifyProject.js:215-217` — once any `test_*.py` exists,
   *every* Python goal runs whole-workspace `pytest -q` instead of its own file. **17 blocks.**
3. **Latent: `.find()` falls through to another goal's file.** Goal 10 names
   `s10_desk.js, s1_library.js, s7_cache.js` in that order. If `s10_desk.js` was never written, the
   entry silently becomes `s1_library.js` and the goal can pass on a file it never touched. Unobserved
   post-fix (the first-named file existed every time), but the code permits it.

The `npm test` branch (`:178`) never fired — these workspaces' `package.json` is a boundary marker with
no `scripts`. 0 npm-test evidence strings archive-wide.

---

## E. The ledger gate — quantified, and it is not the problem

`agent.js:3242`, gated by `!advisory && p.total && p.remainingOwn > 0`. Plan-seeded lists and tasks
carried from earlier runs are deliberately **advisory**, not binding (`taskLedger.js: adopt()`,
`progress().remainingOwn`).

**Across all 1,004 runs the ledger gate blocked 3 times.** Two of those runs finished `done` anyway.
One died: `ca18f099` (14B, `u3_cart.js`) — blocked once on 1 open task, then killed by the loop guard
ten calls later. That is the **maximum** cost: ≤1 goal, archive-wide.

The advisory design is doing its job and should not be touched. By comparison the plan-FILES gate
blocked 10 times and **all 10 runs still finished** — one model call each. Two of those ten were
bogus: `filesFromPlan` parsed `s1_library.js/test_library.js` as a single path, which can never exist,
on a goal about `s2_logs.py`.

---

## F. Ranked by goals recoverable — with the cost of each change stated

**1. Scope the syntax sweep and the pytest run to the goal's own file and its dependencies.**
*Recovers:* 6 goals measured precisely (blocked **only** on unrelated files, still scored FAIL), plus
the ~11 calls each that 15 runs burned fighting an unwinnable block. *Costs:* a genuinely broken
unrelated file stops being a finish-blocker. That is a real loss — leftover wreckage is how a workspace
poisons its successors — so keep it as a loud **note** on the finish, and keep the end-of-run repair.
Net: clearly positive, and the largest single item here.

**2. Refuse `verified` when the run landed zero successful writes.** *Recovers:* the 2 archive cases
(`8e7cf9aa`, `72d91b63`), both of which entered the training corpus labelled `verified`. *Costs:*
essentially nothing — a "create"/"add" goal cannot be met by a run that mutated nothing. The one
principled exception is a goal that is genuinely satisfied by existing code; block it *once* (the
plan-FILES gate's pattern) rather than three times. **Highest confidence-to-risk ratio in this list.**

**3. Reword a block that the goal's own file has already passed.** *Recovers:* no goals directly, but
removes the 11.3-calls-after-block tax on 15 runs and the post-block editing that produced 5 rollbacks
and 6 repair-refusals. *Costs:* none — it is the same decision, honestly described.

**4. Open the 3-strike escape hatch without needing a 4th `finish`.** *Recovers:* up to 3 runs that
died sitting at 3 blocks. *Costs:* marginally more unverified finishes. Small both ways.

**5. Add an export/symbol check to the gate for "add X to EXISTING f" goals.** The machinery already
exists in the tree — `defNames.js` exports `defNames`, `exportNames`, `lostDefs`, `lostExports`, and
`agent.js:36` already imports three of them for the write guard and the rollback. *Recovers:* bounded
above by the 44 verified-but-failed finishes showing `FN-MISSING`, but **that bound is soft** — the
marker extracts prose words as symbol names and over-fires (setJ goal 1: `FN-MISSING(book,owns)` on a
goal that PASSED). *Costs:* **this one can lose goals.** Every false positive is a correct run blocked,
and section C shows what blocking a correct run does. Build it against the goal's *named* identifiers
only, prove the false-positive rate on the replay corpus first, and ship it advisory before it gates.

### Explicitly NOT recommended

- **Do not tighten the ledger gate.** 3 blocks in 1,004 runs; ≤1 goal at stake.
- **Do not re-fix the verifier entry file.** 228 → 0 across setG–setJ. Done.
- **Do not add a stricter exit-code gate.** Already established: of 9 setJ runs that finished verified
  carrying a non-zero exit, **7 scored correct**. This audit adds the reason — 146 of 187 verified
  finishes rest on bare loadability, so exit code is nearly uncorrelated with the goal being met, and
  a strict version would block correct work at scale.
- **Do not spend on the finish gate before the loop guard.** 163 runs died to the two loop-guard
  routes at a **6% and 0%** scoring rate, against 116 budget deaths at 25%. **350 of 583 runs never
  reached the finish gate at all.** The gate is worth the five fixes above; it is not where the goals
  are going.
