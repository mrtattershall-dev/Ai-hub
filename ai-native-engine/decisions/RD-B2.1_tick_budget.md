# RD-B2.1: Global per-tick op budget (Closed) — bounding the tick, not just the transaction

**Question:** RD-B2/I2 capped ops per TRANSACTION and flagged the residue: "per-tx
budget bounds each actor; a thousand actors is a different attack." A session of
many individually-small rule txs (exactly what RD-B5's live run produces) carried
unbounded total work per tick. What bounds the TICK — and how, without breaking
RD-003's arrival-order determinism?

**This is RD-B5's item 0**: the ENFORCEMENT column beside experiments/029's
`classifyOpGrowth`. The classifier measures and never rejects; the budget rejects
and never explains — they compose (measurement names the growth class in the
session scorecard; the budget guarantees the tick stays bounded regardless).

## Method

Implemented as `opts.tickOpsBudget` (default **OFF/null** — existing behavior
unchanged, every prior suite green untouched), enforced in `core/engine.js
submit()` as **layer 0.6**: after move-normalization and the per-tx cap, BEFORE
claims/scheduling — so a budget-rejected tx has **zero footprint** (no claim
placed, no op scheduled, nothing staged; proven in T3: a rejected tx carrying
setfields + claim + delete lands none of them, `claims.size === 0`,
`indexesConsistent()`). Proven in
`experiments/033_tick_budget/tick_budget.js` (22 assertions) and fuzzed in
`experiments/024_concurrency_fuzz/fuzz.js`.

## Rivals

1. **WHOLE-BATCH-REJECT** — if the tick's total demand exceeds the budget,
   reject the entire batch. Trivially deterministic (no admission order at all).
   **Rejected, and the measured case shows why**: in the stepTick control (T7,
   3 systems × 4 ops = 12 demand vs budget 8) whole-batch-reject commits ZERO
   txs — and since systems re-emit every tick, the session wedges permanently
   with no localized fault: no single tx is over any limit, so no re-promptable
   error can name a fix (violates the localized-error discipline). Under the
   winner the same tick commits 2 of 3 systems and hands the third a
   `tick-budget:` reason it can act on.
2. **DETERMINISTIC PER-TX ADMISSION (winner)** — admit txs in the scheduler's
   own cross-actor ordering discipline (actor name via `localeCompare`, then
   batch position for same-actor causal order), accumulating op counts; a tx
   that does not fit is rejected WHOLE (RD-002: a partial behavior is
   corruption — never truncated to fit).
   - Sub-decision, **GREEDY-FIT over prefix-block**: a too-big tx blocks only
     itself; later txs in admission order may still fit. Measured (T4: budget 8,
     a=4 ops fits, b=10 ops rejected, c=2 ops **still commits**) — one oversized
     actor cannot starve the rest of the tick. Deterministic because admission
     depends only on actor names, op counts, and the (arrival-order-independent)
     per-tx-cap rejections — never on arrival order.
   - Interaction rule: a tx already rejected by the per-tx cap consumes **no**
     tick budget (it will commit nothing). Conservatively, txs later rejected by
     claims/validation DO consume budget — also arrival-order-independent, and
     honest: admission is a static pre-pass, not an oracle of downstream fate.

## Negative control (the guard is load-bearing)

T1: budget OFF (the default), 30 actors × 10 ops — **300 ops commit wholesale**,
every tx far under the per-tx cap, no layer objects. T2: same flood, budget 100 —
exactly the deterministic actor-order prefix (10 txs / 100 ops) commits; all 20
rejected txs carry `tick-budget: tick demanded 300 ops … over per-tick budget
100 … rejected whole, zero footprint`. Turn the guard off and the exact
unbounded-work failure reappears: the enforcement is real, not incidental.

## Determinism proof (RD-003/P1, the crux)

- **Deterministic**: T5 — one over-budget batch (8 distinct actors, 13 ops
  demand, budget 7, mixed kinds incl. delete/claim/move) run against 6 seeded
  random permutations on identically-rebuilt worlds: committed-state signature
  AND the exact rejected-actor set identical every time.
- **Fuzzed**: `fuzz.js 10000 1` — every 4th iteration (2,500) runs P1's 6
  permutations AND P5's undo round-trip with a random small budget (1..6 ops vs
  2..10-op demand, so rejection is active, not decorative). **ALL PASS at
  10,000 iterations.** P6 (reload-fork) runs budget-off on BOTH branches:
  persistence is owned by another workstream and does not carry
  `tickOpsBudget` (it is session config, unpersisted like claims/history), so a
  budgeted original vs default-loaded fork would be an instrument artifact, not
  an engine finding — the RD-021 discipline, documented in the fuzzer.

## Composition (measured)

- **Per-tx × per-tick (T6)**: both caps on (10/tx, 15/tick). A 12-op tx dies at
  the per-tx cap (reason names *that* cap) and consumes no tick budget; three
  6-op txs then contend for 15 — two fit, the third gets a `tick-budget:`
  reason. Each failure mode named by its own guard.
- **stepTick/RD-020 (T7)**: a budget-split tick is still ONE undo step for
  exactly what committed; redo restores it; indexes consistent throughout.
- **RD-B5 classifier**: `classifyOpGrowth` (029) stays the measurement column —
  untouched, still 23/23. The live-run scorecard's "budget trips" column now has
  an enforcement mechanism behind it.

## Transferable principle

An admission policy is deterministic iff its inputs are — order by identity
(actor names), not by arrival, and charge the budget on static facts (op
counts), never on downstream outcomes. And when two limits guard one resource
at different granularities, make each rejection name ITS OWN limit: a composed
guard that shares an error message un-localizes both.

## What remains open

- Should `tickOpsBudget` persist with the snapshot once the persistence
  workstream lands? Current pinned semantic: session config, like claims and
  history — a reload starts from the constructor default.
- Budget SIZE policy for the RD-B5 live run (per-model? derived from the
  classifier's bounded-slope baseline?) — an RD-B5 protocol choice, not an
  engine one.
