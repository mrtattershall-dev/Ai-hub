# RD-M0 — Actor input: full pipeline at tick cadence (option (a)) — DECIDED

**Status: DECIDED 2026-07-15 — option (a).** All actor input flows through the
unmodified claim→schedule→validate→commit pipeline at tick cadence. No fast
path (options (b)/(c)) is built. Conditional on the user pinning
`experiments/036_multiplayer/BAR.md` (drafted before this measurement ran).

## The question

M-series prerequisite, flagged spine-decision-grade when Phase C was first
scoped: how does real-time human input reach the engine?
- (a) every input is a tx through the full pipeline at tick cadence — safest;
  is it fast enough?
- (b) a fast path for input, reconciled with the authoritative pipeline later —
  reintroduces an unaudited mutation path (the thing the engine exists to
  prevent).
- (c) hybrid: cosmetic input bypasses; state-consequential input doesn't.

Pinned ordering (memory, 2026-07-15): measure (a) against a pinned bar FIRST;
build (b)/(c) only if (a) fails.

## Method

`experiments/036_multiplayer/m0_latency.js` (zero deps, reproducible — LCG
seed, no Math.random). Bar pinned in BAR.md before the first run: at reference
load (>=1000 live entities sustained, 10 rules incl. one O(pop) aggregation,
8 actors submitting claim+write per tick, >=2000 ticks), tick compute p50<=5ms,
p99<=10ms, zero unsafe.

**Harness v1→v2 correction (honest note):** v1 used the oracle HOMESTEAD rules
at scale; the world SELF-DEPLETED (all crops watered→grown→reaped; the
write-only arm ended at 11 live entities — not a 1000-entity measurement). v2
holds population constant with a non-depleting 10-rule load set and proves the
load with per-tick popMin tracking. The bar never pinned the oracle set; this
is a harness fix, not bar-fitting. v1 results superseded, kept in git history.

## Results (v2, this machine, Node; 2000-tick soaks, 100-tick warmup untimed)

| scenario | pop | rules | actors | input | p50 | p90 | p99 | max | rule-tx rejected |
|---|---|---|---|---|---|---|---|---|---|
| S1 homestead (oracle) | 10 | 5 | 8 | write | 0.04 | 0.11 | 0.72 | 2.5 | 18% `validate:` |
| S2 reference | 1000 | 10 | 8 | write | 5.02 | 7.81 | 11.58 | 19.0 | **0%** |
| S2 reference | 1000 | 10 | 8 | claim+write | 1.27 | 2.59 | 5.11 | 9.2 | **65.5% `claim:`** |
| S3 stress | 5000 | 20 | 32 | claim+write | 12.91 | 24.24 | 347 | 434 | 70% `claim:` |

Solo input submit (one tx, no systems — the input path itself): p50 0.00–0.01ms,
p99 0.01–0.09ms at every scale. **unsafe = 0 everywhere** (index oracle +
identity checks, every 250 ticks + final).

## Adjudication — stated exactly

- **The bar as pinned: PASS** (claim+write arm: p50 1.27, p99 5.11, popMin
  1000, 0 unsafe). **But the pass contains an artifact:** the pinned reference
  shape (claim+write) starves 65.5% of rule txs at the claim layer (finding F1
  below), so the "passing" ticks were doing far less rule work. The world was
  largely frozen except player writes + zone rules.
- **The un-starved same load (write-only): p50 5.02 (bar 5.00), p99 11.58 (bar
  10) — misses the 20 Hz bar at 1000 entities.** At 10 Hz (100ms interval) it
  clears trivially. At game scale (S1) it clears by ~70x.

## Decision rationale — why (a) wins despite the marginal miss

The cost decomposition is decisive: **the input path costs 0.01–0.09ms; the
tick costs 5–12ms because of RULES, not input.** Rules run identically no
matter how input arrives — a fast path for input (b/c) cannot recover a cost
input isn't causing. So the marginal p99 miss at 1000 entities is a
**rule-throughput scale question, deferred to M5 with these numbers as its
baseline**, not an input-path question. (a) is safest AND the rivals are aimed
at the wrong term. Practical consequence: 20 Hz tick at game scale (M1–M4),
10 Hz acceptable at 1000+ entities until M5 does throughput work.

## Findings (each a measured M-series input)

**F1 — CLAIM STARVES RULES (M1/M2-blocking design question).** Layer 1 rejects
a WHOLE tx if any op targets an entity claimed by another actor; a rule's tick
output is ONE tx over EVERY matched entity. Measured: 8 players refreshing
2-tick claims → every all-crop rule (drain matches all 1000) rejected ~every
tick → 65.5% of all rule txs rejected, crop simulation effectively halted by
ordinary player input. One claiming player stalls a matching rule WORLD-WIDE
for the claim's duration. Options to weigh at M1 (a real RD, not a default):
per-matched-entity rule txs (changes atomicity granularity), claims not
blocking systems (changes claim semantics), or input-by-fold-not-claim as the
recommended client shape (write-only arm shows folds absorb 8-way write
contention with ZERO rejections). Not decided here.

**F2 — INTRINSIC RULE-VS-RULE COLLATERAL (pre-existing, first measured).** S1,
oracle rules, NO claims: 18% of rule txs rejected `validate:` — reap deletes a
crop the same tick grow/drain write it; the delete schedules first
(KIND_PRI), the write hits a destroyed target, the rule's whole tx (all crops)
rejects. Single-player HOMESTEAD stalls world growth on every harvest tick and
still won B4 — the cost was invisible until counted. Verified in the shipped
game directly (oracle rules, no harness): tick 7, `sys:rule:grow -> validate:
cannot write growth of a destroyed object`. Same granularity question as F1.

**F3 — FOLDS SCALE CLEAN.** Write-only arm: 16000/16000 player txs committed, 0
rule rejections, 0 unsafe — 8-way same-field write contention against 10 rules
at 1000 entities resolves entirely by RD-005 fold semantics. The
recommended M1 client input shape, measured.

**F4 — S3 strain data point (for M5).** 5000 entities / 20 rules / 32 actors:
p50 12.9ms but p99 347ms / max 434ms — nonlinear spikes (unDiagnosed; GC
suspected, not measured). Also pinned in BAR.md: default per-tx opsBudget 2048
whole-rejects any rule matching >2048 entities — S3 raised it explicitly;
M5 must exercise that cap deliberately.

## What this does NOT establish

No real human timing was measured (M1's job); no transport exists yet (M1
prerequisite, pinned: both clients through the same submit(), never a second
path); the S3 spikes are unexplained; the bar draft is not yet user-pinned.

## Addendum (2026-07-16) — after RD-M0.1 and the journal removal

F1/F2 are RESOLVED by RD-M0.1 (per-entity rule txs, user-decided): claim
starvation 65.5% → 0.9%, intrinsic collateral now per-entity only, at +12%
median tick cost (interleaved A/B, `m01_granularity_ab.js`). The S3 spikes are
EXPLAINED and fixed: `engine.log` retained every committed batch forever
(write-only relic; removed) — its retained graph drove the GC mark-compact
spikes and an OOM at 5000-entity scale post-split.

**Environment caveat on every absolute number in this record:** back-to-back
runs of identical code on this machine differ up to ~3x (p50 26.3 vs 9.5 ms).
Count-based results (rejection rates, unsafe=0) and same-process interleaved
deltas are trustworthy; absolute latencies are machine-state-dependent and the
tabled values above were taken in a fast state. The DECISION is insensitive to
this: the input path costs 0.01–0.09ms in every state measured — 2–3 orders
under any tick interval — and the rule-throughput question belongs to M5
regardless of which state you trust.
