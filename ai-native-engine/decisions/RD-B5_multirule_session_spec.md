# RD-B5 — Multi-rule authoring sessions: SPEC + LIVE RESULTS

**Status: SAFETY CLOSED (decisive). H1/H2 — a first "toward H2" read was WALKED
BACK by a purer follow-up: the rescue is weak, noisy, and mediated by goal
re-specification, not by the observable teaching on its own. Net: back toward
H1 (observable = detection + harness scoring), with a weak re-specification
rescue effect.**

- **CLOSED / decisive:** the unconditional safety gate held across ~600+ live
  rule proposals now (first run + B2-LIVE + rescue run + follow-ups) — **zero
  unsafe events, ever**. The spine's load-bearing claim, measured repeatedly.
- **H1/H2 — the honest arc (a correction I'm keeping visible):**
  1. First run: rescue arm confounded (ceiling + collapse) → "underpowered, open".
  2. Harder-goal run (n=3): FEEDBACK/full 2/3 vs CONTROL 0/3 → I read this as
     "resolved toward H2". **That was overconfident at n=3.**
  3. Purer follow-up (n=3 more, + the isolating clause-NAMES-only arm):
     CONTROL 1/3, FEEDBACK/full 1/3, FEEDBACK/**names-only 0/3**. Aggregating
     the two runs: **control 1/6, full 3/6, names 0/6.** So (a) the full-feedback
     lean (3/6 vs 1/6) is WEAK and NOISY, not decisive at n=6; and (b) stripping
     the goal re-statement to clause NAMES only rescued **0/3** — the teaching
     came from the banner RE-STATING the goal, NOT from the observable's
     failure-detection. **The strong-H2 reading (the observable itself teaches)
     is NOT supported.**
  - **Corrected verdict:** the temporal observable's demonstrated value is
    DETECTION + harness scoring + a trigger to re-prompt; as a standalone
    teaching signal it is unproven (names-only: 0/3). This lands closer to H1
    than my track-3 writeup claimed. The caveat I pinned there turned out to be
    the whole story. See **PURER H2 FOLLOW-UP** below.
- The pre-registered SILENT candidate (opposed-fold) remains observed-but-rare
  (n=1 live). Neither half of the H2 test (silent-mode, nor rescue) delivered
  strong H2 evidence on the isolating measurement.

The pre-registration below is intact and unedited; measured results are in the
final section (**LIVE RUN RESULTS + DECISION**). Reading order is deliberate:
predictions first, then outcomes, so the decision cannot be hindsight-fitted.

**(Original status: SPEC + CALIBRATED APPARATUS.** The decision was pre-registered
to close when the live run executed, after item 0 — global per-tick op budget +
per-model `FB_STYLE` policy — landed. This document exists so the
temporal-contract question is answered by a designed experiment, not discovered
as a surprise bug mid-demo — the RD-021 discipline.)

Apparatus: `experiments/029_multirule_session/multirule_session.js` — 23/23
deterministic assertions, `node <file>` → ALL PASS. Everything below marked
**[measured]** is a number that run produces today.

---

## The question

Every RD-B3/B4 trial was one model → one rule → one isolated goal, gated by a
per-proposal contract. A *game-level* goal ("the farming loop works") is a
property of **several interacting rules over N ticks**. Two rival hypotheses:

- **H1** — per-rule gating + RD-005 fold/defer + RD-B2 invariants already cover
  composition. No new contract form needed; the gate's unit stays "one rule".
- **H2** — composition has failure modes invisible to any single-rule gate; the
  boundary needs a **temporal / multi-rule contract form** (a goal-derived
  predicate over the run trace, in the RD-014 sense, enforced at session level).

### What would falsify each

- H1 is falsified if a session of individually-gate-valid rules produces a
  *wrong* outcome (goal unmet or intent silently destroyed) with **no signal**
  at any existing layer (no rejection, no deferral, no invariant trip).
- H2 is falsified if every composition failure the live sessions produce is
  already surfaced by an existing layer (rejection reasons / deferrals /
  budget), so a session-level contract would be redundant packaging.

### Evidence already in hand (apparatus calibration surfaced it)

The deterministic controls **already found one H1 wound and one H1 defense**:

1. **[measured] OPPOSED-FOLD — silent inter-rule arbitration, zero signal.**
   `boost` (growth+10, clamped) and `decay` (growth−3, clamped ≥0) are both
   individually gate-valid. Installed together, RD-005's max-fold arbitrates
   every same-tick clash: 20 fold events / 10 ticks / 2 crops, **0 deferrals**,
   growth advances at exactly +10/tick — **decay contributes nothing, ever, and
   no layer tells anyone.** RD-005's fold is lossless for *convergent* intents
   (two waterings → wetter wins); between *opposed rules* it silently deletes
   one rule's entire purpose. An authoring model watching its rule get installed
   "successfully" has no way to learn it is being no-opped. This is the
   strongest pre-registered evidence for H2 — unless the live run shows models
   never author opposed-fold pairs in practice (which would be its own finding).
2. **[measured] DELETE-VS-WRITE — caught, localized, but with coupling.** `fert`
   (growth+30) vs `reap` (delete at ≥100), same crop, same tick: the VALIDATE
   layer rejects fert's tx with the localized reason `cannot write growth of a
   destroyed object` — not silent, deterministic across reruns. But atomicity
   couples: fert's tx also carried a write to an *innocent* second crop, and the
   whole tx died — the innocent crop's growth **stalls exactly one tick** (60 at
   t3, resumes 90 at t4). Correct per RD-002 (a partial behavior is corruption),
   but it means one rule's collision degrades another entity's timeline — a
   composition effect no single-rule test ever showed. H1's defense here is
   real (signal exists, localized, repair-promptable); whether a model can
   *use* that signal mid-session is a live-run question.

## The apparatus (calibrated instrument, referee-first)

`runSession({rules, ticks})` installs rule JSON through the **real wire**
(`core/behavior.js installRule`) into the **real engine**, steps N ticks, and
records a per-tick trace: ops/actor, committed/rejected (with reasons),
deferrals, **silent fold arbitrations** (distinct actors, distinct values, one
foldable field — the detector for finding #1), spawns/reaps, population, max
growth, safety. Calibration proofs, all green:

| control | proves | result **[measured]** |
|---|---|---|
| ORACLE (grow/wilt/reap/reseed) | goal achievable in the grammar | observable PASSES; 8 reaps, 14 spawns, 8 live crops at t40; ops/tick **bounded** (slope 0.47→0.06); 0 unsafe |
| MISSING-LINK (minus reseed) | checker can't be gamed | FAILS on sustainability clauses, not safety |
| BENIGN-LINEAR (plant 1/tick) | accumulation ≠ emergent-bad | classified **linear** (slope 1.77→2.0), 0 unsafe |
| SUPERLINEAR (trusted-closure doubler) | classifier can fire at all | **superlinear** (slope 60→2431) — and a rule *cannot express this*: spawn cap is static 1..16, cap=100000 → `spawn_cap_required` |
| OPPOSED-FOLD / DELETE-VS-WRITE | the two composition phenomena above | see Evidence |
| one-tick-one-undo, 4 rules installed | composition inherits RD-020 | ONE undo reverses the whole multi-rule tick |

### The temporal observable (the contract shape under test)

`checkFarmObservable(trace)` = safe ∧ matured(≥100) ∧ reaped(≥2) ∧ reseeded(≥5)
∧ **sustained** (a reap AND a spawn in the last third, ≥1 live crop at end). No
single tick can satisfy it; no per-proposal postcondition can express it. This
IS the H2 candidate contract form, already machine-checkable.

### The op-growth classifier (the confound-killer)

`classifyOpGrowth(trace)` → bounded / linear / superlinear from split-half
slopes. Registered *before* the live run so "the rules interact badly" and "N
rules × M ticks accumulate linearly" cannot be conflated in the write-up. The
item-0 global budget slots in beside it as the enforcement column (this
classifier measures and never rejects; the budget rejects and never explains —
they compose).

## Live-run protocol (DRIVER BUILT 2026-07-15; GPU launch pending explicit go)

Item 0 has landed (RD-B2.1 global budget + FB_STYLE knob). The driver
`experiments/029_multirule_session/multirule_live.js` is built and its mock
apparatus proof is green (8/8: CONTROL 0/4, FEEDBACK 4/4 @ 2.0 attempts, zero
unsafe, and BOTH H2 signals — the missing-reseed near-miss and the opposed-fold
silent-arbitration — verified to reach the model through the feedback string).
JSON extraction robustness-tested against fenced/`<think>`/bare-array/prose
output. Modal launcher `modal_multirule.py` mirrors 028 (transformers shim,
in-volume result persistence, `--detach`; per-model FB_STYLE). The only
remaining step is the conscious GPU spend, held for the user.

**Pinned design choice (driver):** the RULE SET persists/revises across attempts;
each attempt evaluates the *current full set* in a fresh TICKS-tick run — a clean
temporal measurement with no cross-attempt world-state confound. The
live-editing variant (carry running world state across attempts via RD-B6
`installRule({replace:true})`) is a deliberate open extension, not this first cut.

- **Task**: model authors the farming loop into a running world as a SESSION —
  up to R rules, up to A attempts each (world = the persisting/revised rule set;
  each attempt a fresh running-sim evaluation, per the pinned choice above).
- **Arms**: CONTROL (blind retry) vs FEEDBACK (localized errors; `FB_STYLE` per
  model per the RD-B3 repair-mode-collapse finding: echo for dense models,
  errors-only/resample for Qwen3-MoE).
- **Feedback carries session context**: on a failed *observable* (rules all
  installed, loop doesn't sustain), the re-prompt gets the failing clauses of
  `checkFarmObservable` — that is, H2's contract form is *used as the teaching
  signal* to test whether it earns its keep.
- **Score per session**: observable pass/fail, attempts, unsafe events (must
  stay 0 — the gate is unconditional), fold-arbitration count, rejected-tx
  count, op-growth class, budget trips (item 0 column).
- **Models**: Qwen2.5-Coder-32B (known-good), Qwen3-Coder-30B-A3B (collapse
  case), optional 7B. n≥4 sessions/arm/model, Modal H100 as in RD-B3.

### Decision rule (pre-registered)

- Sessions fail the observable **only** via signals existing layers already
  emit (rejections/deferrals the model could read) → **H1**; ship the temporal
  observable as *harness scoring only*, not as an engine contract.
- Sessions fail via **silent** modes (opposed-fold no-op is the known
  candidate) and the observable-as-feedback measurably rescues them → **H2**;
  the temporal contract earns a place at the boundary, and the fold layer needs
  an *inter-rule opposition signal* (surface fold arbitration between distinct
  rule actors as a warning, or defer it like a label clash — that sub-decision
  gets its own negative control then).
- Either way, the OPPOSED-FOLD finding stands as measured and needs an answer;
  H1 vs H2 decides *where* the answer lives (harness vs boundary).

## Explicitly out of scope

Item 0 itself (other session); rule persistence/lifecycle (#2 — next after
this); `sum`/spatial aggregation (defer until a session hits the wall); claim
TTL (#3).

---

# LIVE RUN RESULTS + DECISION (2026-07-15)

**Run:** Modal H100, app `ap-PGKjDZrkrVSMOM9Glbxoiy`. Driver
`experiments/029_multirule_session/multirule_live.js` (mock proof 8/8), launcher
`modal_multirule.py`. Two models, two arms, 4 sessions/arm, ≤4 attempts, 40-tick
farming-loop observable. ~54 live authoring attempts, ~200+ rules gated. Logs:
`session_qwen25_32b_echo.txt`, `session_qwen3_coder_30b_errors.txt`. Both
results also verified persisted in-volume (`modal volume ls hf-cache results` →
`rdb5_Qwen2_5-Coder-32B…echo.json` + `rdb5_Qwen3-Coder-30B…errors.json`), so the
detached "only the last-triggered function survives client death" caveat did not
bite — both containers completed and returned.

**Measured shape (pinned, per the design fork the driver flagged):** these
numbers are the FRESH-SIM-PER-ATTEMPT shape — the rule set persists/revises
across attempts, each attempt evaluated in a clean 40-tick run. The
LIVE-EDITING shape (world state carried across attempts via
`installRule({replace:true})`) is UNMEASURED. The go-ahead was a one-word
"launch the gpu" that did not explicitly resolve this fork, so the run
proceeded on the driver's pinned default; a reader wanting the live-editing
verdict must run that variant — it is a different question.

| model (FB_STYLE) | CONTROL | FEEDBACK | meanAtt | unsafe | foldArb | opGrowth |
|---|---|---|---|---|---|---|
| Qwen2.5-Coder-32B (echo) | **3/4** | **3/4** | 2.3 | 0 | 0 / 2 | all bounded |
| Qwen3-Coder-30B-A3B (errors) | **0/4** | **0/4** | — | 0 | 0 | all bounded |

## The headline: the unconditional safety gate held perfectly

**~200+ live rule proposals across both models at SESSION scale → ZERO unsafe
events** (no index desync, no identity break, no hang; `indexesConsistent()`
every tick of every attempt). RD-B3's single-rule headline replicates one level
up: composition does not open a corruption path the per-rule gate misses. This
is the load-bearing result and it is decisive.

## The H1-vs-H2 verdict: no contract compelled yet, but UNDERPOWERED — not H1

**Failure modes were dominantly SIGNAL-BEARING, not silent** — which points away
from an urgent H2 need, but see the sample-size caveat below before reading this
as H1:

- **Qwen3-MoE (0/4 both arms):** failed via `spawns=0` in nearly every attempt —
  it either omitted a periodic-plant rule (the missing-link shape) or authored a
  spawn rule the gate REJECTED at install (`installed < rules`, recurring). Both
  are signals the model could read: an install rejection is localized and
  re-promptable; "nothing is being harvested/replanted" is in the observable it
  was fed. Nothing silent broke it.
- **Qwen2.5-32B (3/4 both arms):** failed sessions were near-misses corrected
  within a couple of attempts. The pre-registered SILENT candidate —
  **opposed-fold** — occurred in exactly ONE session (foldArb=2) and **that
  session PASSED anyway.** So the strongest H2 candidate was observed in the wild
  but was rare AND non-fatal. This is exactly the sub-finding the spec
  anticipated ("unless the live run shows models never author opposed-fold pairs
  in practice — which would be its own finding").

**Decision (provisional, revisable by a harder-goal run):** ship
`checkFarmObservable` as **harness scoring only** for now. No new
temporal/multi-rule contract form at the engine boundary *on this evidence*, and
no inter-rule opposition signal in the fold layer yet — the opposed-fold no-op
remains REAL (calibration + one live occurrence) but at n=1 live it is
underpowered to justify a boundary cost. This is "not yet compelled," not
"ruled out": the OPPOSED-FOLD finding stands as measured and the door to H2
stays open for a run that makes models author opposed pairs often enough to
characterize.

## The confound (pinned, not swept): the rescue arm could not decide cleanly

The H2 test's second half — "observable-as-feedback *measurably rescues* silent
failures" — is **confounded on both models and cannot be read either way**:

- 32B sat at a **ceiling** (3/4 baseline, no headroom; feedback 3/4 — RD-018.1/
  RD-B3 already predicted feedback ≈ no-op for a capable proposer).
- MoE was in **repair-mode collapse** (0/4 both arms — the RD-B3 finding, here
  even under the errors-only style RD-B3 found least-bad for it).

So "feedback did not rescue" is the ceiling+collapse confound, NOT clean
evidence that the temporal observable lacks teaching value. **What would make it
decisive:** a regime that is neither saturated nor collapsing — the 32B (or a
similar dense model) on a HARDER game-goal (multi-zone, or one needing the
`count`/spatial grammar) tuned so baseline success is ~40–60%. That is the clean
follow-up — NOT a re-run of this goal.

## Secondary findings

- **The RD-B3 capability curve replicates at session scale.** 32B ≈ ceiling in
  both arms; MoE collapses to 0/4. And composition is materially harder than
  single-rule authoring: the MoE, which sometimes one-shot single rules in
  RD-B3, **cannot assemble a sustaining loop at all.**
- **MoE failure, characterized from the run's own counts (free, no GPU).** The
  MoE produced **zero spawns across all 32 attempts** — it never once authored a
  working periodic-plant rule. Splitting by install counts:
  **19/32 attempts were fully-VALID rule sets with no plant mechanic at all**
  (installed == rules, spawns = 0 — nothing for the gate to reject, pure
  OMISSION); **13/32 had ≥1 rule REJECTED at install.** This partly answers the
  "can't express it vs. collapse-blocks-the-retry" question: the *dominant*
  failure (59%) is omission — the model doesn't attempt a valid plant rule at
  all, so there is nothing for repair-collapse to act on. That leans toward a
  capability / prompt-comprehension gap over pure repair-policy failure.
- **Instrument limitation (honest correction).** The driver logged install
  *counts* but not *codes* AT RUN TIME, so for the 13 rejection attempts we
  cannot say *which* gate code fired (was the rejected rule the plant rule, a
  grammar friction, or something else). `rejectCodes` was added to the scorecard
  *after* this run — it is **NOT** recoverable from this run's logs (stderr was
  empty; only counts were emitted). So the 13 rejection cases remain
  unattributed, and only a **re-run** (with the new instrumentation) can
  illuminate them — and it would illuminate only those ~40%, since the ~60%
  omission cases have nothing to reject. This is a genuine "needs GPU" follow-up,
  not a free extraction.
- **Op-growth bounded everywhere, budgetTrips 0** (budget off) — no runaway; the
  item-0 per-tick budget was not needed for this goal, consistent with the
  classifier. Its value remains for adversarial/among-many-small-txs sessions,
  not this one.

## Open, post-decision

1. **The clean rescue measurement** (non-ceiling, non-collapse regime) — the
   thing that would actually resolve H1 vs H2 rather than leave it underpowered.
   Needs a harder goal (~40–60% baseline: `count`/spatial or multi-zone) so
   observable-as-feedback has room to show a rescue, on a dense model that isn't
   at ceiling. GPU spend; deliberate decision.
2. **Diagnose the 13 MoE install-rejection attempts** — requires a re-run (codes
   were not captured this run; now instrumented). Would only address ~40% of
   MoE failures; the ~60% omission failures are already characterized as
   capability/comprehension. GPU spend; lower priority than (1) since the
   headline MoE story (zero plant rules ever) is already established for free.
3. The OPPOSED-FOLD no-op stays on the books as a known, rare (n=1 live),
   harness-scored phenomenon; it re-opens as a boundary question only if a
   future goal makes models author opposed pairs often enough to characterize.
4. **The LIVE-EDITING session shape** (world state carried across attempts) is
   unmeasured — a distinct question from the fresh-sim-per-attempt shape this run
   measured. Open until explicitly chosen and run.

---

# HARDER-GOAL RESCUE RUN (2026-07-15) — first "toward H2" read [SUPERSEDED]

> **Superseded by PURER H2 FOLLOW-UP below.** The 2/3-vs-0/3 result here was
> n=3 and did not hold up: a second run got 1/3-vs-1/3, and the isolating
> clause-names-only arm rescued 0/3. Read this section as the first datapoint,
> not the conclusion. Kept intact (not deleted) so the correction is visible.

This is open-item #1 above, executed. Built on HOMESTEAD
(`experiments/034_homestead_game/b3_rescue.js` + `modal_rescue.py`), the score
rule is made HARD — it must use the RD-B7 scoped `sum` (accumulate the total
growth of the field's own ready crops) — so a capable model is NOT at ceiling.
Two arms, session-level: **control** re-authors blind on a lost session;
**feedback** re-authors with the failing `checkHomesteadObservableHard` clauses.
Per-rule authoring runs the RD-B8 collapse-aware repair loop. Hard oracle
confirmed winnable (tally 800). Modal H100, 3 sessions × ≤2 rounds/arm. Results
in-volume `results/rescue_*.json` + local `rescue_*.txt`.

| model | control | feedback | unsafe |
|---|---|---|---|
| Qwen2.5-Coder-32B (dense) | **0/3** | **2/3** (both rescued on the retry) | 0 |
| Qwen3-Coder-30B-A3B (MoE) | 0/3 | 0/3 (feedback got closer: tally 100–160 vs 0) | 0 |

## Findings

1. **The rescue is REAL and now UNCONFOUNDED — H2.** Dense 32B, off-ceiling
   (0/3 baseline, so no ceiling confound; dense model, so no collapse confound):
   **FEEDBACK 2/3 vs CONTROL 0/3.** Round 1 loses (`scored` fails — the
   scoped-sum score rule doesn't install or is wrong); round 2 WITH the failing
   observable clauses installs 5/5 and WINS (tally 800). Blind control never
   recovers. The temporal observable, used as feedback, TEACHES — the H2 evidence
   the first run's confounded arm couldn't produce. `checkFarmObservable`-style
   observables earn a place beyond harness scoring.
2. **Safety unconditional, again.** ~200+ more live proposals (2 models × 2 arms
   × 3 sessions × 2 rounds × 5 rules × repair), **zero unsafe**. Cumulative
   across all RD-B5 runs: ~400+ live proposals, zero unsafe, ever.
3. **RD-B8 live (collapse-aware repair):** the detector fired in EVERY session of
   BOTH models — it triggers on any per-rule repair that repeats a rejected
   output, which the hard scoped-sum rule provokes even in the capable model (so
   "collapseSeen" is per-rule-repeat, not per-model pathology). It composes
   cleanly: a collapse on the hard score rule is isolated to that rule's repair,
   so the 32B still wins 2/3 via the session-level rescue. On the MoE it did not
   yield a win (the hard goal is beyond it) but feedback moved it from tally 0 →
   100–160 — closer, not there. Sound mechanism, not a capability substitute.
4. **The 32B's failure localized to the scoped-sum score rule** (`installed 4/5`
   every control round) — the RD-B7 grammar's hardest construct, and exactly
   where the rescue mattered.

## Honest caveat (pinned)

The feedback banner both NAMES the failing clause (`scored`) AND RE-STATES the
target ("accumulate sum of ready growth ≥ 300"), so the rescue mixes
failure-DETECTION (which needs the observable) with goal RE-SPECIFICATION
(clearer words). The observable is necessary — nothing else detects "the loop
scored too low" — but a purer H2 test would feed back ONLY the clause names,
isolating the observable's teaching value from prompt clarification. That
refinement is the next cheap GPU run if wanted. The claim this run supports:
"the temporal observable as a feedback signal measurably rescues a dense model
on an off-ceiling goal (2/3 vs 0/3)" — strong, and no longer confounded.
**[Update: that "strong" claim did NOT survive the purer follow-up — see next.]**

---

# PURER H2 FOLLOW-UP (2026-07-15) — the "toward H2" read walked back

The caveat above got its GPU run (`modal_followup.py` → 32B, 3 configs). Same
hard scoped-sum goal, 3 sessions each:

| arm | this run | + rescue run | aggregate |
|---|---|---|---|
| control (blind) | 1/3 | 0/3 | **1/6** |
| feedback / full (names + target restated) | 1/3 | 2/3 | **3/6** |
| feedback / **names only** (clause names, NO target restated) | **0/3** | — | **0/3** |

## Findings (and a correction I'm keeping)

1. **The rescue is WEAK and NOISY, not decisive.** Across both runs the dense
   model's control baseline is 1/6 and full-feedback is 3/6 — a lean, but at
   n=6 with per-run swings of 0/3–2/3 it is nowhere near the clean "2/3 vs 0/3"
   I reported from the single rescue run. That earlier writeup over-rotated on
   n=3 noise; this corrects it.
2. **Clause-NAMES-only feedback rescued 0/3 — the decisive datum.** Strip the
   goal RE-STATEMENT and feed back only the failing clause names, and the rescue
   VANISHES. So whatever teaching effect the full banner had came from
   RE-SPECIFYING the goal (words a human/harness author wrote), NOT from the
   observable's failure-detection. **The strong-H2 reading — "the temporal
   observable itself teaches" — is not supported.**
3. **Net verdict → closer to H1.** The temporal observable's established value is
   DETECTION (it alone notices "the loop scored too low") + harness scoring + a
   trigger to re-prompt. As a *standalone teaching signal* it is unproven. The
   caveat pinned in the rescue section turned out to be the whole story.
4. **Safety, again:** zero unsafe across all follow-up arms.

## RD-B8 A/B (rode along) — detector validated; the switch did NOT help live

`b8_ab.js`: single hardest-rule authoring, modes control/echo/auto, 8 trials.

| model | control | echo (fixed FB) | auto (collapse-aware) | collapse-seen (auto) |
|---|---|---|---|---|
| 32B (non-collapse control) | 6/8 | 8/8 | 8/8 | 0 |
| Qwen3-MoE (collapse case) | 0/8 | **2/8** | **1/8** | 7/8 |

- **Detection is validated and SPECIFIC:** on the MoE the detector fired 7/8
  (it does reproduce rejected outputs); on the 32B it fired 0/8 (it doesn't).
  So "collapse detected" tracks the real pathology, not a label.
- **The resample SWITCH did not earn its keep live:** on the 32B it ties fixed
  feedback (8/8 = 8/8 — no harm, but never triggered). On the MoE, auto (1/8)
  did NOT beat echo (2/8) — within n=8 noise, if anything slightly worse. So
  RD-B3's "blind resample beats feedback" did NOT replicate on this single-rule
  task; here fixed feedback was marginally better. **The switch's benefit is
  unproven; the honest RD-B8 result is: detector sound, intervention unproven
  (maybe counterproductive) at this n.**

