# Set H — the same 100 goals, twice, with the hub as the only variable (PRE-REGISTRATION, written before the window opens)

tatte: "Go ahead and run another 14b", then "Run both and compare", then — correcting my reading of "both" —
**"No, run 2 14 b one with the updates and one without"**, and "It gives us plenty of offline training data".

So this is not set G repeated with two models. It is **one model, two hubs**: an A/B where the only thing that differs
is whether the wave-1 fixes are present. Every earlier comparison in this project has been across *sets* (F vs G), which
confounded the hub change with everything else that moved between runs. This one does not.

## The design

    model    Qwen/Qwen2.5-Coder-14B-Instruct-AWQ on A10G, served as coder14b   (identical in both arms)
    goals    goals-H.json — sha256 1f29e971e72f9461…, byte-identical to set G's goals-G.json and set F's goals-F.json
    checks   tools/checks-H.mjs — sha256 ea0d8b53535313ef…, byte-identical to set G's and set F's checker
    harness  tools/trialH.mjs, identical to trialG.mjs except ONE line: the hub entry point is now an env override
             (HUB_ENTRY), because trialG.mjs hardcoded the working tree — see "Why the hub is pinned" below
    caps     AGENT_MAX_STEPS=30, AGENT_MAX_MINUTES=8, AGENT_BATCH_ACTIONS=0, supervisor off, fresh empty workspace
    cost     A10G ~95 min x 2 ≈ $3.2; running total after this ≈ $43

    ARM 1 (control, "without the updates")
      hub      main b07c72b, in a clean pinned worktree at C:/Users/tatte/Projects/ai-coding-hub-setH
      note     the RUNTIME hub here is byte-identical to dae46b2, the hub set G measured: the only server/ change
               between dae46b2 and b07c72b is a new *.test.mjs file, which the hub never loads. Verified with
               `git diff dae46b2..main -- server/ ':!server/*.test.mjs'` → empty. So arm 1 is also a REPLICATION of
               set G's 14B arm, which is what makes the variance estimate below possible.
      app      coder14b-sethctl   (as launched; the 30B control ran as coder30b-sethctl)

    ARM 2 (treatment, "with the updates")
      hub      main + wave-1 fixes, in its own worktree, launched only after every fix has a failing test written
               first and a mutant proving the test can see it. Nothing unpinned enters a paid run.
      app      coder14b-sethfix   (30B treatment: coder30b-sethfix)

## Why the hub is pinned (a defect found while preparing this run)

`trialG.mjs:31` read `const HUB = '…/ai-coding-hub/server/index.js'` — the **working tree**, not a commit. It logs the
commit sha, which makes its output look authoritative while it can be running uncommitted code. Set G was launched this
way. Today the working tree is dirty and two fix agents are editing `server/` in it, so launching as-is would have
measured half-finished code and labelled it `main`. Arm 1 therefore runs from a clean worktree checked out at `main`
with zero modified entries, and `HUB_ENTRY` selects it explicitly. This is the only difference from set G's harness.

## Predictions, fixed before the window. Each says what would falsify it.

1. **Arm 1 (control) reproduces set G's 14B arm within noise: 2-7/100 implementation-correct, 45-70 goals attempted.**
   Set G scored 4/100 with 58 attempted. Falsified if arm 1 lands outside those bands — which would itself be the most
   valuable result here, because it would mean the rig's run-to-run spread is wide enough that set F vs set G (2 → 4)
   and 30B (36 → 29) were never interpretable in the first place.
2. **This run produces the first variance estimate for this rig, and that is the point of arm 1.** I have been
   comparing scores across sets as though the noise were zero. Until this number exists, no claim of the form "the
   fixes moved the score" can be made honestly, including about the twenty already merged.
3. **Arm 2 attempts MORE goals than arm 1: 75+ of 100, versus ~58.** Mechanism, measured in set G rather than assumed:
   363 `edit_file` calls, 241 of them identical repeats, 201 of which wrote to disk again, and four runs died at exactly
   the 30-call cap with zero tool errors. Bounding the successful identical repeat returns those calls to the budget.
   Falsified if arm 2 attempts no more goals than arm 1 — which would mean the repeats were not what exhausted the cap.
4. **Arm 2's workspace contains no duplicated definitions, where arm 1's does.** Set G's kept workspaces hold
   `s6_graph.py` at 1987 lines with 28 `def __init__` and 33 `def nodes`, and `s3_matrix.js` at 2374 lines with 27
   `constructor`. This is the corruption the duplicate refusal exists to stop; it is a direct, countable check that does
   not depend on the score moving at all.
5. **The score may not move even if 3 and 4 both hold, and that would still be a real result.** Set G's lesson was that
   the binding constraint MOVED (destruction → budget) without the score improving. If arm 2 attempts more goals, stops
   corrupting files, and still scores the same, then the ceiling is the model and not the tools — and that is the answer
   the north star needs, not a disappointment.

## What I will NOT claim afterwards

- That a difference between arms is real without reference to prediction 2's variance figure.
- CORRECTED 2026-09-12, after this was written: set G's regression numbers DO exist and are
  `coder30b-setg: 78 goals run | worked when written 33 | works at the end 29 | REGRESSED 6` and
  `coder14b-setg: 58 goals run | 6 | 4 | REGRESSED 2` (set F: 30B 48/36/16 over 100 goals run). I had written that there
  was "no number" because the artefact `coder30b-setg-regress.txt` was committed **empty** at `0130652` and the rig
  discarded its child's exit status (both true, both now fixed). But the analysis had completed and its result was in a
  task output I had not read: a missing FILE is not a missing RESULT, and I asserted the stronger claim without
  checking. Both numbers are now written into the artefact files. The figures in COORD near line 4255 remain **set F's**
  and must not be quoted as set G's.
- That statuses mean anything on their own. Judge by the hidden checks against the workspace, per set G.

## Rules for the window

Status file written before any GPU time so the watchdog is armed first (Rule 7a: `stopApp.mjs` only, `watchdog.sh` at
110 min, distinct app names per arm so a stop targets exactly one). Rule 3 identity proved against `/api/health` naming
`Qwen/Qwen2.5-Coder-14B-Instruct-AWQ` before a single goal runs. Laptop on AC — verified `PowerOnline: True`,
`BatteryStatus: 2`, 100% (a battery sleep cut set E at goal 64). Independent `python -m modal app list --json` at the
close of each arm. Records kept per arm: run files, transcripts, traces, run index, workspace git bundle — which is
also the offline corpus tatte asked for. `server/hub.json` is never copied.

## Arms 2 and 4 (treatment) — pre-registered before launch

The treatment hub is **`eaa70c1`**, a merge holding exactly three fixes, each reproduced red-first against a real hub
and each proven by mutants that made its test go red:

  47b05b3  one honest `finishKind` verdict in BOTH run-index.jsonl and traces.jsonl, and route 2 (`cleanTests>=3`),
           which previously set no marker at all, now marked. 6 mutants, 6 caught.
  458db0b  `edit_file` encodes what it actually wrote across all five write paths; an edit that would leave a DUPLICATE
           of a definition the file already has is REFUSED; and repeat detection for mutating tools keys on the ARGS,
           not the answer — without which the honest answer silently disables the stuck-run stop. 6 mutants, 6 caught.
  6b4f2f3  the end-of-run repair may not reach back past the goal it is repairing: bounded to
           <first-checkpoint-parent>..HEAD when the run landed a write, refusing when nothing there parses, unbounded
           only when the run wrote nothing; records an error and a machine-readable marker beside the note, and commits
           whatever it did. 6 mutants, 6 caught, incl. one proving the no-writes carve-out is load-bearing.

On the merged tree: rollbackBounded 9/9, rollbackCarryover 3/3, runLifecycle 9/9, editTruth 18/18,
unverifiedFinishRecorded 10 passed / 1 known-open (route 2's gate bypass, deliberately left open and documented).

Everything else is held identical to the controls: same goals-H.json, same checks-H.mjs, same model, same caps, same
A10G/H100, a fresh empty workspace, and the hub pinned via HUB_ENTRY to a clean worktree at this commit.

**The prediction that decides this run** (from the list above, restated with its falsifier): arm 2 attempts MORE goals
than arm 1 — 75+ of 100 against the control's count — because 241 of the 14B's 363 edit_file calls in set G were
identical repeats and 201 of those wrote again, and four runs died at exactly the 30-call cap with zero tool errors.
Falsified if arm 2 attempts no more goals than arm 1, which would mean the repeats were not what exhausted the budget.
And the countable check that does not depend on the score: arm 2's workspace should contain no duplicated definitions
where arm 1's does (set G left s6_graph.py at 1987 lines with 28 `def __init__` and 33 `def nodes`).
