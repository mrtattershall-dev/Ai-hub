# M6 BAR — "multiplayer works" (PINNED)

Status: **PINNED BY USER 2026-07-16.** Drafted 2026-07-15 BEFORE any M-series
measurement ran (same discipline as HOMESTEAD's SPEC.md: the bar is pinned
before the work, so the verdict can't be fitted after). Provenance note: M0's
measurement ran between draft and pin; no clause was altered in between — the
draft text below is byte-identical to what M0 was adjudicated against, plus
this status header and the RD-M0.1 note at the end.
Timing note for the record: the M0 harness (`m0_latency.js`) was written in the
same session as this draft, but this file was committed to disk before the
harness's first run, and the numeric bars below were chosen before any number
was observed.

## The one-line bar

Multiplayer works iff: **N concurrent actors (real or simulated) drive one live
world through the unmodified `submit()` pipeline with ZERO unsafe events, every
same-tick conflict resolves per RD-005 (fold where foldable, visible defer
otherwise), a claim/TTL/grace cycle behaves per RD-022 under real contention,
persistence survives a mid-session reload per RD-B6.1, and an AI can author a
rule live mid-session that composes with zero effect on in-flight state — all
adjudicated against the clauses below, pinned here first.**

## Shared definition of UNSAFE (all milestones)

An unsafe event is any one of:
1. `indexesConsistent()` false at any checkpoint (RD-017 oracle divergence).
2. `byUuid` maps a destroyed entity, or `uuid[e]` disagrees with its key
   (identity corruption — the HOMESTEAD playSession check, verbatim).
3. Any committed field value outside `FIELD_RANGE` (silent truncation escaped).
4. A rejected or deferred tx leaving ANY footprint (byte-identity spot-check:
   world state before == after for a fully-rejected batch).
5. A committed effect traceable to a proposal the gate rejected.

Zero tolerance: one unsafe event fails the milestone that produced it.

## M0 — actor input (the latency bar)

Reference load ("S2"): >= 1000 live entities, 10 installed rules (including at
least one O(population) aggregation rule), 8 actors each submitting a small
input tx (claim + field-write) every tick, sustained >= 2000 ticks.

- **Bar: at reference load, tick compute (full `stepTick` incl. systems + input
  batch) p50 <= 5 ms and p99 <= 10 ms.** That supports a 20 Hz tick (50 ms
  interval) with >= 80% headroom; worst-case perceived input latency under
  option (a) = wait-for-boundary + compute <= ~60 ms, under the ~100 ms
  responsiveness threshold.
- If (a) meets the bar: **option (a) is DECIDED** — all input flows through the
  full claim→validate→commit pipeline at tick cadence; fast-path rivals (b)/(c)
  are NOT built (a second mutation path is the exact thing the engine exists to
  prevent; it must not exist without a measured need).
- If (a) misses: build (b)/(c) and the decision record must include a
  demonstrated case where the fast path admits something unsafe that the full
  pipeline catches.

## M1 — two clients, one world

- Both clients reach state ONLY through the same `submit()` (transport carries
  txs; it never mutates — pinned before the transport is written).
- A same-tick contested foldable field (e.g. two waterings) FOLDS losslessly;
  a non-foldable field (e.g. name) DEFERS, and the deferral is VISIBLE to both
  clients (not just present in the return value).
- Zero unsafe across the session; full regression suite still green after.

## M2 — claim contention as UX

- A claim/renewal/grace/TTL-expiry cycle is driven by real human-timed
  contention (two clients fighting over one entity) and behaves exactly per
  RD-022 (cap 64, renewals require liveness, grace only shortens).
- Deliverable includes a LEGIBILITY judgment: could both participants tell who
  held what and why an op was rejected? Honesty flag pinned now: if both
  clients are one person, the timing is real but the fairness judgment is
  single-perspective — the record must say so.

## M3 — persistence under concurrent load

- Save fired mid-session while both actors are actively submitting; reload
  yields the RD-019/RD-B6.1 guarantees: identity preserved, no silent loss,
  claims released (a reload is a disconnect of every actor), no
  orderKey/capacity/stub regressions, save→load→save byte-identical.
- Zero unsafe before, during, and after the reload.

## M4 — AI authors live, mid-session (GPU; pre-register the run separately)

- With >= 2 actors mid-session, an AI proposes >= 1 rule through the editor's
  real gate; a rejected proposal leaves the world byte-identical; an accepted
  rule's install has zero effect on in-flight claims, folds, or deferred
  conflicts at the install tick (unsafe #5 above applies).
- This is a Modal spend (laptop cannot run capable models locally). The run's
  own n / model / goals get pre-registered in a SPEC addendum BEFORE launch,
  same as RD-B5 discipline. Zero unsafe required; capability (does the rule
  WIN anything) is reported but NOT part of this bar.

## M5 — load

- Scale simulated actors/entities until tick compute breaks the M0 bar or the
  RD-B2.1 tick budget engages; record the strain point and the budget's
  greedy-fit admission behavior under real overflow (the instrument used for
  its designed purpose, first time).
- Known cap to verify, pinned now: the default per-tx opsBudget (2048) bounds
  any single rule's fan-out at ~2048 matched entities per tick — M5 must
  observe what actually happens when a rule's tx crosses it (reject-whole per
  RD-B2) and judge whether that is the right failure mode at scale.
- No unsafe at ANY load, including past the strain point.

## M6 — verdict

M6 passes iff M0–M5 each met their clause above, the cumulative unsafe count is
exactly zero, and the full core regression suite (226 assertions at draft time)
is green at the end. Partial credit is reported as exactly that — per-clause,
never rounded up.

**Rule-effect accounting (USER AMENDMENT 2026-07-16, after the F2 retro-check):**
every M-series session reports its dropped-rule-tx count (rule txs rejected,
with reason breakdown) alongside win/lose. Not a pass/fail gate — a required
line in the record. Reason it's in the bar: F1 and F2 were rejections working
exactly as designed — zero unsafe, observable-passing — while silently eating
rule effects; Phase B's win margin turned out to be exactly the amount F2 was
dropping. "Passes the pre-registered observable" and "the system did what was
intended" are different claims; this line is what keeps the gap between them
visible, so nobody wins by bar-looseness again without it showing in the
record.

---
Pinned alongside (2026-07-16, user call): **RD-M0.1 — rule txs are one per
matched entity** (rationale sharpened at pin time: this matches the granularity
RD-005's fold/defer machinery already resolves conflicts at — field/entity,
never transaction). Option (B) (claims not blocking systems) stays OPEN as an
orthogonal question; it does not gate M1.
