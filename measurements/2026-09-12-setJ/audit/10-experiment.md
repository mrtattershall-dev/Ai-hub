# Audit 10 — the experiment itself: goals, comparability, and whether the conclusions follow

Read-only audit, 2026-09-12. Nothing was edited, started or stopped; the three set J arms were left alone.
Every number below is computed from artefacts on disk (`*-checks.json`, `*-rows.json`, `*-setX.log`, `tools/`),
not from the prose of any README.

**Headline: the fixes are not failing. The instrument is. Twenty goals are ~10 independent tasks, roughly
half of the denominator in every published score is goals that were never attempted or goals that were
unwinnable because an earlier goal failed, and the residual failure is the model writing wrong code and
certifying it with a test it wrote from its own implementation — which no hub fix touches.**

---

## A. The twenty goals: unambiguous, but not independent

The goals themselves are well written. Each names its file, its functions, its error behaviour and its
expected output shape, and I found no goal whose plain reading contradicts the checker. Two minor wording
risks are recorded at the end of this section. The problem is not ambiguity — it is **coupling**.

### How the checker actually scores

`tools/checks-J.mjs` (md5 `e3e9aaaa5811ee7a4525c4c62e09c70e`) holds **ten chains**, one per project. Each
chain is a *single script* of ten `step()` calls executed against the **final** workspace, and
`goal = (step - 1) * 10 + project`. So goals 1-10 are step 1 of each project and goals 11-20 are step 2.

Two distinct coupling mechanisms follow, and both are load-bearing.

### Coupling 1 — a file that does not parse fails all ten of its goals at once

`runScript()` returns `{ load: ... }` when the module will not import, and the driver then marks **every one
of that project's ten goals** failed with the same `load:` reason. This is not a per-goal penalty; it is a
project wipeout. Measured:

| arm | goals of 100 lost to `load:`/`missing`/`no result` | of the first 20 |
|---|---|---|
| setG 14B | 38 | 8 |
| setH 14B control | **48** | **10** |
| setH 14B treatment | 38 | 8 |
| setG 30B | 38 | 8 |
| setH 30B control | 10 | 2 |
| setH 30B treatment | **0** | 0 |
| setI dense 32B | 0 | 0 |

The set H 14B control lost **half its entire score sheet to five files that do not parse** (`s1` 9/9,
`s3` 10/10, `s4` 10/10, `s7` 10/10, `s10` 9/9). Its published "2/100" is not a measurement of 100 attempts.

### Coupling 2 — every goal 11-20 exercises the API that goal 1-10 was supposed to build

This is the "the EXISTING &lt;file&gt;" question, and the answer is yes for all ten projects. Read from the
checker's step-2 bodies:

| goal | second-pass check | what it re-requires from the first pass |
|---|---|---|
| 11 | `l.addBook('111','Dune',2); l.checkout(...); available===1` | goal 1's `addBook`/`copies` |
| 12 | `parse_log` paths + `bad_lines==[3,8]` | goal 2's `parse_line` shape-detection **and** its `ValueError` discipline |
| 13 | `new X([[1,2],[3,4]])`, `add`/`sub`, `toArray` | goal 3's constructor and `toArray` |
| 14 | `"<h1>Title</h1>\n<p>text under it</p>\n<h2>Sub</h2>\n<h3>Small</h3>"` | **goal 4's `<p>` paragraph wrapping** |
| 15 | `'-(2+3)*2' === -10`, unclosed paren throws | goal 5's arithmetic + throw discipline |
| 16 | `bfs` over a graph built with `add_edge` | goal 6's `add_edge`/`neighbors` ordering |
| 17 | `delete`/`clear` on a cache filled with `set`/`get` | goal 7's `set`/`get`/`has`/`size` |
| 18 | `percent` over `add_student`/`add_assignment`/`record` | goal 8's whole API |
| 19 | adds cards through `#s9-new`/`#s9-add`, then clicks `.s9-right` | **goal 9's add-a-card path** |
| 20 | `lib()` + `l.checkout('111','ann')` then `availability==='1/2'` | goals 1, 10 **and 11** |

**Yes — if goal 4 is failed, goal 14 is effectively impossible.** The step-2 assertion is a whole-document
comparison that includes `<p>text under it</p>`, so a model that adds headings perfectly still fails goal 14
unless goal 4's paragraph wrapping is intact. This is not hypothetical; it is the observed failure in three
separate arms:

- setI dense 32B — goal 4 fails (`one paragraph 'Hello world'`, no `<p>`), goal 14 then fails with
  `'<h1>Title</h1>\ntext under it\n<h2>Sub</h2>\n<h3>Small</h3>'`. **The headings are correct.** The only
  thing wrong is goal 4's defect, scored a second time.
- setG 30B — goal 4 fails, goal 14 fails with `'<p># Title</p>...'`.
- setJ 14B — goal 14 fails with `'<p><h1>Title</h1></p>...'`.

Goal 20 is worse: it needs goal 1 (a Library with `addBook`/`copies`), goal 10 (`s10_desk.js` exporting), and
goal 11 (`checkout`). **No arm in any set has ever passed goal 20** — 0 for 8.

### Coupling 3 — cross-project: s10 requires s1 and s7 to import

`const S10` begins by `require`-ing `s1_library.js` and `s7_cache.js`. So one unparseable `s1_library.js`
costs goals **1, 11, 10 and 20** — a fifth of the 20-goal set from a single file. Observed in every arm where
s1 was broken (setG 14B, setH 14B control, setH 14B treatment): goals 10 and 20 both fail carrying *s1's*
syntax error as their reason.

### Achievability in 30 tool calls

Not the binding constraint on goals 1-20. Median calls per goal is 8.6-23.7 across all arms, and goals that
hit the 30-call cap within the first 20 are 0-4 per arm (setJ: 14B 1, 30B 2, 32B 3). The README's claim that
the budget does not bind on goals 1-20 is correct.

### Two wording risks worth recording (neither is a design flaw)

- **Goal 12** — "skipping blank and malformed lines; bad_lines returns the 1-based line numbers of the
  malformed lines that are not blank". The checker's fixture contains a whitespace-only line (`"   "`) at
  line 6 and expects `[3, 8]`. A strict reading of "blank" as "empty string" yields `[3, 6, 8]` and fails.
- **Goals 6 and 8** — "raises ValueError unless weight is a positive number" / "a max_points that is not a
  positive number". The checker passes the *string* `"3"` / `"10"` and requires `ValueError`. The natural
  implementation `if weight <= 0` raises `TypeError`. This is a fair test of a real defect, but it is the
  single most repeated failure in the corpus (setH 30B control, setI dense ×2, setJ 32B) and it punishes an
  exception *type*, not the behaviour the prose describes.

---

## B. Quantifying the coupling: failing the first pass makes the second pass unwinnable

Computed over **8 arms × 10 projects = 80 (goal N, goal N+10) pairs** — setG 14B/30B, setH 14B ctl/fix, setH
30B ctl/fix, setI dense, setJ 14B:

|  | second pass PASSES | second pass fails |
|---|---|---|
| **first pass PASSED** | 18 | 14 |
| **first pass FAILED** | **4** | **44** |

    P(second passes | first passed) = 0.563   (n = 32)
    P(second passes | first failed) = 0.083   (n = 48)

**Failing the first pass cuts the second pass's chance by 6.8x.** Only 4 of 48 second-pass goals were ever
won after a failed first pass, and all four were narrow first-pass misses on a detail step 2 does not
re-test (setI s1: "copies 1.5 did not throw"; setH 30Bctl s6; setH 30Bfix s5; setH 14Bctl s8).

### What this does to the ceiling and to every published percentage

The 20 goals are **not 20 independent tasks — they are 10 projects drawn twice, with the second draw
conditioned on the first.** Consequences:

- A model that is right on 7 of 10 projects has an expected score of roughly
  `7 + (7×0.563 + 3×0.083) ≈ 11.2 / 20`, not 14/20 — and 20/20 requires *perfection on all ten projects*,
  because a single first-pass defect costs two goals.
- The MoE's 15/20 is 9 first-pass wins and 6 second-pass wins; the dense 32B's 6/20 is 5 and 1. The gap
  between them is driven as much by the conditional as by raw competence.
- **Single failures are double-counted.** s4's missing `<p>` is one defect scored as two goal failures (10
  percentage points). A broken `s1_library.js` is one defect scored as four (20 points).
- Every "/20" percentage is therefore against a denominator of 20 nominally-independent tasks when at most
  10 are independent. The honest denominator for a capability claim is **10 projects**; the honest reading
  of the second ten goals is **a retention measure**, not ten more chances.

---

## C. Final-workspace scoring: how often did a later goal destroy an earlier pass?

The checker scores the final workspace, so a goal can be won and then lost. Split into the two causes:

### Exact measurements that already exist (goals 1-20, checkpoint reconstruction)

Set I rebuilt two arms at their own goal-20 checkpoint from `workspace.bundle`:

| arm | at its goal-20 checkpoint | after all 100 goals | destroyed |
|---|---|---|---|
| setH 30B treatment (MoE) | **15/20** @ `064e062` | 14/20 | 1 (`s4_markdown.py` goal 4 — PASS at goal 20, `NameError: _escape_html` at goal 100) |
| setH 14B treatment | **4/20** @ `42ebd75` | 3/20 | 1 (`s9_board.html` goal 9) |

So within the first 20 goals of a 100-goal run, **1 goal per arm (5-7% of the first-20 score) was won and
then destroyed by later work.** Both baselines in set J are the reconstructed (higher) numbers, which is the
conservative choice — see (E).

### Independent lower bound across all of sets H and I

"The harness recorded the file running at the end of its own goal, but the final file does not even import":

| arm | attempted | ran when written | **written then destroyed** | never got working code written |
|---|---|---|---|---|
| setH 14B control | 49 | 23 | **8** (35% of those written) | 26 |
| setH 14B treatment | 51 | 32 | **7** (22%) | 19 |
| setH 30B control | 58 | 56 | **4** (7%) | 2 |
| setH 30B treatment | 53 | 50 | **0** | 3 |
| setI dense 32B | 20 | 18 | **0** | 2 |

(This is a lower bound: it catches only files that stop *parsing*, not ones that still parse and behave
wrongly.)

### The historical trend, from the project's own `regress` rig

    setC 14B   10 written -> 7 at end    3 REGRESSED (30%)
    setC 30B   32 -> 32                  0
    setE 14B   19 -> 15                  5 (26%)
    setE 30B   41 -> 35                  8 (20%)
    setF 30B   48 -> 36                 16 (33%)
    setG 30B   33 -> 29                  6 (18%)
    setG 14B    6 -> 4                   2 (33%)
    setH 30B treatment  (this audit)      0 catastrophic of 50

**Destruction fell from ~33% to ~0% on the 30B treatment arm. That is the twenty fixes working.** And the
score still barely moved — which is the puzzle, and section G answers it.

**The binding loss has moved.** Set H 30B treatment: 53 attempted, 50 ended with a file that ran, 0
destroyed, 39 scored. That leaves **11 goals that were written, ran, survived to the end, and were simply
wrong.** Not destruction. Not budget. Incorrect code.

---

## D. Cross-set comparability

### Verified identical (by hash, not by claim)

- **Checker** — `checks-F/G/H/I/J.mjs` all md5 `e3e9aaaa5811ee7a4525c4c62e09c70e`. The claim holds. ✓
- **Goals** — `goals-F/G/H.json` all md5 `4139bff78118a31ebec5454cbe85a446`; `goals-I20.json` and
  `goals-J20.json` both `d804b7531123dd97a686cf61764f762e`, and element-by-element identical to the first 20
  entries of `goals-H.json` (20/20). ✓
- **Caps** — `AGENT_MAX_STEPS=30`, `AGENT_MAX_MINUTES=8`, `AGENT_SUPERVISOR=0`, `AGENT_APPROVAL_MODE=build`,
  fresh empty workspace: identical in trialF/G/H/I/J. ✓
- **Harness** — trialF == trialG (`b6088f6d`), trialH == trialI (`eedfba9f`); trialJ differs from trialH only
  in deriving `HUB_ENTRY`/`fullAgent.mjs` from `HUB_TREE` and recording the agent.js md5. `neutral.cjs`
  identical across all five. ✓
- **Hubs** (the intended independent variable), verified by hashing the worktrees on disk:
  `ai-coding-hub-setH` (main) `cf2336b17238` = setF/G/H controls; `ai-coding-hub-fix` @ `eaa70c1`
  `6647c9479311` = setH treatments + setI; `ai-coding-hub-indent` @ `3d7a080` `d53b1f230cb0` = setJ. ✓
  (Set I's own log prints `hub cb1f8ce…`, the main checkout — the known provenance bug. It is verifiable
  only because `ai-coding-hub` HEAD happens to carry the same agent.js md5. Do not read hubs off logs.)

### NOT identical — two differences that make the trend line unsafe

**D1. The wall-clock window, and no set J arm finished its goals.**

    setG / setH   no new goals after 87 min, for 100 goals
    setI          no new goals after 52 min, for 20 goals — finished all 20 in 38.6 min
    setJ          no new goals after 47 min, for 20 goals (CAP_MIN=55, watchdog 65 min)

    setJ 14B  16/20 attempted  "window closed: 4 goal(s) not started"
    setJ 30B  18/20 attempted  "window closed: 2 goal(s) not started"
    setJ 32B  17/20 attempted  (still in flight at audit time)

**2 to 4 goals per arm were never started and are scored as failures against a denominator of 20.**

**D2. Machine load. Set I ran one arm; set J runs three concurrently, and the arms are 40-50% slower.**

| arm | concurrency | mean s/goal (1-20) | goal 9 | goal 5 |
|---|---|---|---|---|
| setH 30B control | 2 arms | 46 | 21 s | 36 s |
| setI dense (baseline) | **1 arm** | 116 | **54 s** | 60 s |
| setJ 14B | **3 arms** | 178 | **377 s** | 395 s |
| setJ 30B | 3 arms | 169 | **579 s** | 163 s |
| setJ 32B | 3 arms | 152 | **344 s** | 211 s |

The same goal 9, same caps, same checker: 54 s solo, 344-579 s three-up. The per-goal step and minute caps
are identical, but the **wall-clock window is shared**, so set J's arms are throttled by local contention and
then truncated by the window. The treatment condition is measurably harsher than the baseline condition it
is being compared against. This alone could account for a 1-3 goal deficit.

**D3. Not a defect, but fatal to "the trend line D→J":** the sets vary model (14B AWQ / MoE 30B / dense 32B),
hub (4 distinct trees), goal count (100 vs 20) and concurrency (1/2/3 arms). There is no single line to draw.
Only the within-set A/Bs (set H's four arms; set J vs its own reconstructed baselines) are clean comparisons.

---

## E. The set J baselines

All three are **correct and correctly computed**. I recomputed each from the on-disk checks:

| target | claim | verification |
|---|---|---|
| 14B **4/20** @ `42ebd75` | set H treatment, reconstructed | `BASELINE_BY_GOAL` marks goals 3, 7, 9, 17 = 4. On-disk setH 14Bfix first-20 = 3 (goals 3, 7, 17). The reconstruction adds goal 9, consistent with the s9 board being destroyed after goal 20. ✓ |
| MoE **15/20** @ `064e062` | set H treatment, reconstructed | marks goals 1,2,3,4,6,7,8,9,10,12,13,15,16,17,18 = 15. On-disk setH 30Bfix first-20 = 14 (same set minus goal 4). Matches set I's `_escape_html` narrative exactly. ✓ |
| dense **6/20** | set I, its own 20 goals | marks goals 2,7,9,10,11,17 = 6, byte-for-byte the on-disk setI result. Needs no reconstruction — that arm ran exactly 20 goals. ✓ |

Both reconstructions move the baseline **up** by one, i.e. against the fixes. That is the right direction and
the README is honest about it.

### But the guard against the truncation error is dead code

`compare-setJ.mjs` defines `targetOverRange()` at line 42 with a comment calling it "the TRUNCATION RULE,
fixed before any set J number was visible… Comparing a truncated arm against a 20-goal target would
understate it." **`targetOverRange` is never called.** `grep` finds it only at its own definition; the
printed table uses the fixed `r.target` from the `ARMS` array. `BASELINE_BY_GOAL` therefore feeds nothing.

The arms *are* truncated, so the rule matters:

| arm | attempted | target **as printed** | target over the range actually reached | observed |
|---|---|---|---|---|
| 14B | 16/20 | 4 | **3** | 4 |
| 30B | 18/20 | 15 | 15 | 14 |
| 32B | 17/20 | 6 | 6 | (not scored yet) |

So the 14B's honest comparison is **4 vs 3 over 16 goals (+1)**, not 4 vs 4 (0). One goal, on one arm, this
time — but the protection the README advertises is not in force, and had an arm stopped at goal 8 the error
would have been large. Note also that the 14B's "4/20" is really **4 of the 16 it reached (25%)** against a
baseline arm that reached all 20.

---

## F. Statistics: set J cannot detect the effect it was built to measure

### The real 20-goal noise

The README quotes "±1-2 over 54-59 goals". The direct 20-goal replication evidence is better and is already
on disk — two pairs of runs with identical hub, model, goals and checker:

    14B : setG 3/20  ->  setH control 2/20    spread 1
    30B : setG 10/20 ->  setH control 12/20   spread 2

**The same absolute spread on a third of the denominator**, i.e. proportionally three times worse. Binomial
SD at n=20 is 1.8-2.2 goals; the 95% range is ±3.5-4.4 goals.

### Fisher exact, one-sided, two independent 20-goal arms

| comparison | p | detectable? |
|---|---|---|
| **Prediction 1**: 14B 4/20 → 7/20 | **0.24** | no |
| 14B 4/20 → 10/20 | 0.048 | this is the threshold |
| **Prediction 2**: MoE 15/20 → 17/20 | **0.35** | no |
| MoE 15/20 → 20/20 | 0.024 | only perfection |
| **Prediction 3**: dense 6/20 → 9/20 | **0.26** | no |
| dense 6/20 → 13/20 | 0.028 | this is the threshold |

**Plainly: the set J design is underpowered for all three of its pre-registered predictions.** Every
predicted effect (+3, +0 to +2, +1 to +4 goals) sits inside the measured noise. The smallest detectable
moves are +6 on the 14B, +7 on the dense, and *nothing at all* on the MoE.

Two aggravating factors:

- **The goals are not independent** (section B), so the effective n is nearer 10 projects than 20 trials. At
  the project level a baseline of 2/10 needs 7/10 to reach p<0.05.
- **Prediction 2 is close to unfalsifiable**: baseline 15, ceiling 20, predicted band 15-17.

The README's own caveat ("a 1-2 goal move means nothing; only a clear margin counts") is correct but
understated — the design cannot produce a clear margin for any realistic effect size.

---

## G. The puzzle: twenty-plus fixes, and the score will not move

**It is not "either/or". The fixes worked on what they targeted; the score is incapable of showing it.**
Four things compound, with numbers.

**1. The fixes worked, and have already been cashed in.** Destruction of working code: 33% of written goals
in set F → 18% in set G → **0 of 50** in set H's 30B treatment arm. Duplicated-definition files on the 14B:
10 → 2, with `s7_cache.js` going from 1398 lines (`size ×28, has ×27, constructor ×26`) to absent. Those are
real, countable wins. They are also nearly exhausted: there is no third of the workspace left to save.

**2. The two set J fixes mostly never fire.** Counted in the run records by the three in-flight watchers:
the 14B arm — 0 `matched ignoring indentation`, 0 `ALREADY HAVE LANDED`; the MoE — 0 and 0, because it sends
**27 `write_file` against 6 `edit_file`** and so never presents a tolerant-match or no-op-edit condition. Only
the dense 32B exercised fix 1 (18 firings, all `OK:`). Worse, one watcher traced `noChangeAt()` to
`agent.js:812`, reachable only from the tolerant paths at `:825`/`:832`, while a byte-identical FIND/REPLACE
returns earlier at `:714` with the old wording — so the fix sits off the path its own motivating failure
traverses. **A fix that never fires cannot move a score in either direction.**

**3. Roughly half of every denominator is not a measurement.** Goals never attempted: 42-51 of 100 in every
set F/G/H arm (the 14B control attempted 49). In set J, 2-4 of 20 per arm, because three concurrent arms in a
47-minute window run 40-50% slower per goal than set I's solo baseline. And of the goals that *are*
attempted, the second ten are conditioned on the first ten: P(second | first failed) = **0.083**. One defect
in `s4_markdown.py` costs two goals; one unparseable `s1_library.js` costs four. A model right on 7 of 10
projects tops out near 11/20.

**4. The noise is bigger than any fix.** Observed 20-goal run-to-run spread is 1-2 goals; theoretical 95%
range is ±3.5-4.4. Twenty fixes each worth a fraction of a goal cannot be seen one 20-goal run at a time.

### And the thing that is actually limiting the score now

Set H 30B treatment: **53 attempted → 50 files ran when written → 0 destroyed → 39 scored.** Eleven goals
were written, ran, survived to the end, and were wrong. Set J 30B: 18 attempted, 16 `done`, 14 scored. The
residual is not the hub. The watchers documented the mechanism from the live records:

- `console.assert` does not throw in Node, so a JS deliverable prints `All asserts passed!` and `EXIT: 0`
  with four assertions failing on stderr beneath it.
- The model writes asserts *from its implementation instead of the spec*:
  `assert to_html("Hello\nWorld") == "Hello World"` — ratifying a `to_html` that emits no `<p>` at all, on a
  goal whose text says `<p>...</p>` and which its own transcript quotes three times.
- `if weight <= 0` / `if max_points <= 0` without coercion, in unrelated projects, repeatedly.

Consistent with this, the checker's `impl` (own asserts neutralised) has **never once** differed from `asIs`
across all eight scored arms — 0 "correct code, own test wrong" cases in 800 goal-scorings. The models'
tests are not wrong about right code; they are right about wrong code.

### What would make the number move (or make it honest)

1. **Call `targetOverRange()`, or delete the claim.** It is documented, reasoned-about, and dead.
2. **Publish two denominators**: score / goals reached, alongside score / 20. The 14B's 4/16 and 4/20 are
   different claims.
3. **Score at each goal's own checkpoint**, not the final workspace. The `replay/regress.mjs` rig already
   does exactly this and reports "worked when written" vs "works at the end" as two numbers. Running it for
   sets H/I/J would replace my lower-bound proxy with the real split.
4. **Score per project, or treat goals 11-20 as a retention metric** and report them separately. Do not add a
   conditional trial to an unconditional one and call the total 20.
5. **Run arms sequentially, or size the window to the slowest arm.** Set J's baseline (set I) ran solo at
   116 s/goal; its treatment ran three-up at 152-178 s/goal and none of the three finished.
6. **Accept that 20 goals cannot detect +3.** Either go to ~100 goals per arm, or compare *paired per-goal*
   outcomes against the same baseline arm (McNemar on discordant pairs) rather than totals — and expect to
   need ~10 discordant pairs before anything is readable.
7. **The next fix is not a hub fix.** Refuse a finish whose own test file cannot fail (`console.assert` in
   Node), and require the deliverable to be checked against the goal text rather than against the
   implementation. That is where the remaining 11-of-53 lives.
