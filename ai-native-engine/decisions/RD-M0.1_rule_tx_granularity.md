# RD-M0.1 — Rule-tx atomicity granularity: one tx PER MATCHED ENTITY — DECIDED

**Status: DECIDED 2026-07-15 (user call, rivals weighed in RD-M0 F1/F2).**
An installed RULE's tick output is submitted as one transaction per matched
entity, not one transaction for the whole rule. An entity's effects stay
atomic; cross-entity collateral rejection is gone.

## The problem (measured, RD-M0)

A rule's tick output was ONE tx over EVERY matched entity, and the pipeline
rejects txs WHOLE. Two measured consequences:
- **F1:** one player claim on one crop whole-rejected every all-crop rule tx,
  world-wide — 8 claiming players froze the crop simulation (65.5% of rule txs
  rejected at the claim layer).
- **F2:** claim-free — reap's delete + grow's write to the same crop in one
  tick whole-rejected grow for ALL crops (18% of rule txs in vanilla
  single-player HOMESTEAD; `validate: cannot write growth of a destroyed
  object`, tick 7).

## Rivals rejected

- **(B) claims don't block systems** — changes claim semantics for everyone and
  does nothing about F2, which is claim-free.
- **(C) keep whole-rule txs, mandate write-only input** — folds do absorb write
  contention (F3), but C also cannot fix F2, and it turns a measured engine
  cost into a permanent client-side discipline.
- **(A) per-matched-entity txs — CHOSEN.** The rule fn already generates each
  entity's ops independently (one pass over matched entities); per-entity is
  the natural atomicity unit for authored rules. RD-002's "a partial behavior
  is corruption" is preserved at the right altitude: ONE ENTITY's effects
  (set+delete+spawn for that entity) still commit or reject together — what's
  removed is only the accidental coupling BETWEEN entities.

## What is deliberately preserved

1. **Trusted hand-written systems are UNCHANGED** (whole-tx). They are code,
   may span entities deliberately, and predate this decision. The split is
   opt-in via `registerSystem(name, fn, {txPerEntity: true})`; only
   `installRule` (authored content) sets it.
2. **RD-B2 opsBudget bound on a rule's TOTAL tick output.** Splitting into tiny
   txs would silently void the per-tx budget as a bound on rule fan-out. So the
   budget is checked against the rule's WHOLE output BEFORE splitting: if the
   total exceeds opsBudget the output is submitted UNSPLIT and Layer 0.5
   rejects it whole — byte-identical to the old bound.
3. **RD-003 determinism.** Matched entities iterate in ascending index order,
   groups preserve insertion order, split txs share the rule's actor id and
   tie-break by batch position — committed state cannot depend on arrival
   order, same as before.
4. **RD-020 one-tick-one-undo** — history groups per submit batch, unchanged.
5. **RD-005 conflict resolution** — write-groups key on (target, field) across
   txs, so folds/defers between rules and players are unchanged.

## Grouping key

`op.target` for setfield/delete/reparent/claim; `op.parent` for createChild
(a spawn effect's subject is the matched entity it spawns under). Every op kind
a rule can emit has exactly one of these.

## Measured consequences (2026-07-16)

**Starvation collapse (the goal) — confirmed, robust (count-based, immune to
timing noise):** S2 claim+write rule-tx rejection rate **65.5% → 0.9%** — only
the claimed entity's tx rejects, the other 999 commit. S1 vanilla HOMESTEAD:
the reap-vs-grow collateral (F2) now rejects only the reaped crop's grow tx.

**Perf cost — +12% median tick, p99 unchanged.** Measured by
`m01_granularity_ab.js`: SPLIT vs WHOLE INTERLEAVED IN ONE PROCESS (5 reps
each), because back-to-back runs of identical code differ ~3x on this machine
(26.3 vs 9.5 ms p50 — cross-run comparisons here are noise; only same-process
deltas are trustworthy). Median-of-reps: WHOLE p50 23.24 / p99 36.01, SPLIT
p50 25.99 / p99 36.09 → **x1.12 p50, x1.00 p99** at 1000 crops / 10 rules /
8 actors. An earlier apparent "2x regression" from cross-run comparison was
machine noise; retracted.

**Exposed a pre-existing engine defect (fixed):** the first post-split S3 run
(5000 entities) crashed OOM at the 2GB heap. Root cause was NOT the split
per se: `engine.log` journaled EVERY committed batch forever — write-only
since RD-020 landed (grep: one writer, zero readers repo-wide) — and the split
multiplied retained tx wrappers ~1000x past the limit. The relic journal is
REMOVED (engine.js keeps an explanatory comment); S3 now completes, and the
retained-graph GC mark-compact spikes (max 1767ms observed) went with it.

**Game dynamics measurably changed, ground truth holds:** S1 equilibrium
population 10 → 7 — grow no longer stalls world-wide on harvest ticks, crops
mature faster, get reaped sooner. HOMESTEAD oracle still WINS, all named
near-misses still LOSE, b5 checkpoint 7/7, full core suite 226/226, RD-B2
fuzzer 32/32 (2000 worlds x 5960 rules: determinism/indexes/identity/bounded-
growth/undo all hold under the new granularity). Zero test edits were needed.

**Retro-audit of Phase B (2026-07-16, user-requested):** no decided verdict
flips — every replayable Phase B adjudication (oracle, near-misses, B2-LIVE
run 2 from captured bodies) reproduces under WHOLE and holds under SPLIT
(`experiments/036_multiplayer/f2_retrocheck.js`, 16/16). Regime labeling: the
retro-check ran on the POST-FIX engine; its WHOLE arm emulates the historical
granularity via the txPerEntity flag, validated by byte-exact reproduction of
the published Phase B finals. 8/8 = pre-fix historical record; 10/10 =
post-fix, what the engine now produces. But F2 had been
depressing the numbers: 130 dropped ops = 2 reaps + 2 tally per 40-tick oracle
game (true 10/10 vs published 8/8), and the scored-bar margin was exactly
F2's bite — a scored>=9 bar would have flipped B4/B5. Details + the
not-replayable list: addendum in `experiments/034_homestead_game/SPEC.md`.

**Scale note (→ M5):** S3 (5000 entities, 20 rules, 32 actors) now runs ~85k
txs/tick under split — p50 ~270ms in a slow machine state. Per-tx fixed
overhead genuinely dominates at that scale; absolute throughput at 5000+
entities is M5's question, with these numbers (and the machine-variance
caveat) as its baseline.
