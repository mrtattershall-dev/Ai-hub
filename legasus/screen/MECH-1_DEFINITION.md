# MECH-1 — definition, frozen before any generation

2026-09-25T13:50Z. Hub commit: the commit that carries this file. Authorization: the
mechanism assignment's **$10 total incremental cap**, target ≤ $8 planned; no separate
confirmation is requested within that scope.

## The question

**What in the automatic diagnostic moves the model's first action, and does the content of
the failing cases matter beyond the fact of being told?** The audit (`MECHANISM-AUDIT.md`)
located the earliest divergence at the first model action and found the first edit decides
the unit. Two explanations remain open and were never separable in AUTODIAG-1/2 because the
arm that separates them never existed:

    H1 SEMANTIC       the failing inputs and expected-vs-actual values let the model
                      localize the bug            -> predicts C > B ≈ A
    H2 NOTIFICATION   being told, at the right moments, that tests were run and how many
                      fail is what moves the first action; the model localizes by itself
                                                  -> predicts B ≈ C > A
    both              partial credit to each      -> predicts A < B < C

And the 8/15 → 2/15 instability was two UNSEEDED draws. This run sends a sampling seed, the
same one across arms within a replicate, so arm contrasts are within-seed and the seed-to-seed
spread within an arm is visible on its own.

## Design: whole-run, three arms, two seeds, counterbalanced

Checkpoint continuation (branching from preselected failure states) was the preferred
candidate and is NOT used: the Hub has no API to resume a run from a recorded history, and
faithful restoration cannot be established without building one. Whole-run it is.

    tasks       the 15 QuixBugs tasks already selected by SELECTION.json (rule fixed before any
                model run: alphabetical, first 15 eligible). REUSED, not held out. No
                generalization claim will be made from this run.
    arms        A  CONTROL       seed + guidance; nothing delivered
                B  NOTIFY        seed + guidance; the Hub runs the graded cases and delivers ONLY
                                 "N cases attempted, P passed, F failed" — same header, same
                                 delivery points (before the first call; after any tool that
                                 changes the target's bytes), no case, input, expected or actual
                A  ...           (the summary-mode message is autodiag.js `mode: 'summary'`;
                                 nothing in it is hand-authored)
                C  AUTODIAG_ARM  as AUTODIAG-1/2: counts plus up to 6 failing cases
    seeds       replicate 1 → AGENT_SEED 101, replicate 2 → 202, sent as options.seed on every
                request, recorded as run.sampling.seed and row.seedSent
    order       for task index ti in replicate r the arm list [A,B,C] is rotated by
                (ti + r − 1) mod 3; each arm is first/second/third in 5 tasks per replicate;
                position recorded per row
    units       15 × 3 × 2 = 90
    isolation   fresh workspace and fresh hub per unit; isolation MEASURED per row from the
                transcript (CONTROL: zero diagnostic messages; NOTIFY: zero case-detail lines)
    unchanged   model (Qwen2.5-Coder-7B-Instruct on A10G, temperature 0.2), worker image
                sha256:fa49b576…, route bounding, acceptance, independent evaluator, repeat
                guard, 300 s per task, no retries, mechanical run/summary join by runId

**What each arm sees.** Identical: system prompt, supplied file, workspace listing, guidance,
tool set, budget. A sees nothing more. B and C each see one additional user message at each
delivery point; B's is the counts-only form, C's the full form. B and C receive the same
NUMBER of messages at the same points, so the arms differ only in the message's content.

## Primary outcome and comparisons

**Primary: accepted repair (disposition RETAIN)** per unit — the independent evaluator's
requested and protected verdicts both PASS on the candidate. Everything else is secondary.

Paired by (task, seed), three contrasts, each reported as discordant-pair counts (X-only vs
Y-only) with both-and-neither, per seed and pooled:

    C vs B   the content of the cases         (H1 lives or dies here)
    B vs A   the notification alone           (H2 lives or dies here)
    C vs A   replication of the AUTODIAG effect under seeded sampling

Secondary, per arm and per seed: first tool called; first THOUGHT class; first-edit effect
(cases passing before vs after the first edit, B and C only); recovery after a bad first edit;
termination class; regressions produced and restored; elapsed; model calls; deadline aborts;
diagnostics delivered; repairs by order position.

## Pre-registered readings — and their falsifiers

- **H1 supported** if C-only exceeds B-only in the C-vs-B pairs AND B-vs-A is near-even.
  **Falsified** if B's repair count is at least C's with no C-only excess.
- **H2 supported** if B-only exceeds A-only AND C-vs-B is near-even. **Falsified** if B ≈ A
  (discordant pairs balanced) while C > A.
- **Both** if A < B < C with both contrasts showing an excess in the predicted direction.
- **First-action shift** is predicted in B AND C (edit_file as first tool). If B's first action
  stays at run_python like A, H2 loses its proposed mechanism even if B's repairs rise.
- **Seed spread.** The two seeds give a within-arm difference for each arm. No rate is claimed
  from two seeds. If the seed probe (below) shows seeded outputs are NOT reproducible on this
  backend, seeds are labels only and the sampling-variance hypothesis stays open; that is
  stated, not worked around.
- **No interpretation is pre-assigned to a null.** A flat result across arms is reported as
  such with its denominators; it neither erases AUTODIAG-1/2 nor confirms them.

**Uncertainty.** For each contrast: discordant counts and an exact two-sided sign test on the
discordant pairs, reported DESCRIPTIVELY. The 30 pairs are 15 tasks × 2 seeds — not 30
independent tasks — so the task-level view (tasks where an arm wins under both seeds, one
seed, neither) is reported beside it and carries more weight than the pooled count. Tasks are
public and may be in training data; that limitation is unchanged from every earlier run.

**Missing data.** A unit that is not COMPLETED (UNATTEMPTED, halted, hub not started) makes
its pair INCOMPLETE for every contrast that needs it; incomplete pairs are listed, never
imputed, and every denominator is printed. A case-measurement error does not affect the
primary outcome (acceptance is independent of case counting) and is reported on the row.

## Budget, bounds, stopping

Pricing verified 2026-09-25 at modal.com/pricing: A10 $0.000306/s (= $1.1016/h); CPU
$0.0000131/core/s; memory $0.00000222/GiB/s. Conservative container rate used below:
**$1.55/h** (GPU + up to 4 cores + 32 GiB); GPU-only $1.10/h.

    planned wall clock      deploy+warm ~5 min, probe <1 min, 90 units × ~92 s ≈ 138 min
                            (AUTODIAG-2 means: control 105 s, treatment 66 s; NOTIFY assumed
                            ≤ control), shutdown <1 min          ≈ 2.5 h
    PLANNED spend           ≈ $2.8 (GPU-only) to $3.9 (conservative)      target ≤ $8  ✓
    campaign bound          AUTODIAG_TOTAL_SEC=12600 (3.5 h) enforced by the runner's wall
                            clock (outerDeadline.test) — stops ACTIVE work
    watchdog                gpuWatchdog.mjs, detached before the campaign: stops the app on
                            the campaign's DONE file or at 13800 s from its own start,
                            observes `stopped`, up to 3 retries × 10 min verify
    scaledown backstop      MYCODER_MIN_CONTAINERS=0, MYCODER_SCALEDOWN_S=900: if every stop
                            fails, billing ends ≤15 min after the last request by itself.
                            (AUTODIAG-1/2 ran min_containers=1; this changes when the
                            container may go idle, not what it serves. The probe warms it
                            and the campaign never idles 15 min between requests.)
    MAXIMUM exposure        13800 s + 36 min retries + 15 min scaledown ≈ 4.7 h
                            → $5.2 (GPU-only) / **$7.3 (conservative)**   < $10 cap  ✓
    gate before each paid   accrued + this unit's MAXIMUM + reserve ≤ $10, checked in the
    unit                    launch record with the figures of the moment
    stopping                the campaign ends at queue completion, the wall bound, or a runner
                            HALT (unconfirmed shutdown). NO early stop on favourable results.
                            NO automatic rerun. NO second campaign under this authorization.
    no dollar guarantee     Modal bills after the fact; every figure above is an ESTIMATE
                            from verified unit prices and observed durations, and is labelled
                            so until the invoice.

## Procedure (server/mech1Launch.sh)

    stage1   commit this file → deploy (MIN_CONTAINERS=0, SCALEDOWN 900) → start the watchdog
             detached (deadline 13800 s, sentinel = the campaign's DONE file) → wait for
             /api/tags → seedProbe.mjs (3 short requests: same seed twice, then none)
    gate     accrued so far (deploy+probe, minutes) + campaign MAXIMUM + reserve ≤ $10
    stage2   the campaign: AUTODIAG_EXPERIMENT=MECH-1, arms CONTROL,NOTIFY,AUTODIAG_ARM,
             AUTODIAG_REPS=2, AUTODIAG_SEEDS=101,202, AUTODIAG_TOTAL_SEC=12600,
             AUTODIAG_DONE_FILE=<sentinel>, AUTODIAG_HUB_COMMIT=<HEAD>
    after    `modal app list --json` for stopped_at; mechanismAudit.mjs over the root;
             MECH-1_RESULT.md with every paired outcome, the seed probe, the shutdown
             timeline from all layers, and costs (estimated until invoiced)

Everything that runs is committed before stage1. Deviations, if any, are recorded as such.
