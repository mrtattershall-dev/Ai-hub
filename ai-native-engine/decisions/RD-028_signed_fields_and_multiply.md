# RD-028 — Signed fields + multiply: making expressible things AUTHORABLE

**Status:** ✅ DECIDED (2026-07-16, same day) — **H1 + H2 confirmed, H3 no leak.**
Signed fields (Int8/16/32 pools) and `{mul:[a,b]}` both land; every bar passed.
`experiments/042_pong/pong_v2_test.js` 22/22; all 17 suites green UNMODIFIED.

**Bar 2, the authoring delta (the point of the card):** Pong went from **16 rules
with 4 unnatural encodings** to **11 rules with none** — same game, same oracle,
same behavioral assertions. Velocity is now `-3`, not `125`. Negation is
`mul:[vx,-1]`, not `sub:[256,vx]`+clamp. The paddle bounce is a branchless
`vx + hit*(-2vx)` (`hit = min(count(paddles near),1)`) — collapsing v1's 6 rules,
2 helper fields, and 2-tick lag into 2 rules with no helpers and no lag. Input is
one signed field and ONE rule (`y + input_dir*speed`) instead of two.

**Bar 3, proof intact:** `mul:[vx,vx]` on a `[-8,8]` field is refused
`range_unprovable` (interval = the 4 corner products); a signed UNDERFLOW
(`sub:[vx,5]` → `[-13,3]`) is refused — the proof is sign-aware, not just
overflow-aware; the clamped multiply installs; a range beyond Int32 is refused at
`defineType`.

**Bar 4, sign safety:** Int8/Int16 pools round-trip negatives; `min`-fold over
negatives picks -90; `additive`-fold sums to -800; writing -200 to an Int8 field is
REJECTED not wrapped; negatives survive save/load byte-identically; the RD-025 grid
still works on types carrying signed fields.

**The finding the test forced (v2's first run FAILED and was right to):** the
direction gate is NOT an encoding artifact, as this card assumed. Without it the ball
re-reverses every tick it remains inside HIT_R and oscillates in place at x≈20,
never scoring. **Proximity is a CONDITION that persists while overlapping, not an
EVENT that fires once** — so "only when travelling toward the paddle" is
semantically necessary in any condition-based formulation, not a workaround. It costs
one `where` and no new grammar, so RD-027's "no `on:` needed" holds; but this is the
one real argument edge-triggers have, and it is now on the record with a measurement
rather than a hunch.
**Origin:** RD-027's H2 evidence. Pong is expressible today — but only via four
encodings a human found and an AI author plausibly would not. Since AI authoring IS
the thesis, "expressible but unauthorable" is a capability gap, not ergonomics.

## The four encodings RD-027 was forced into (the spec)

1. **Unsigned ranges** ⇒ velocity is offset-encoded: `vx=128` means zero, `+3` is
   `131`, negation is `sub:[256,vx]`, and every read is `sub:[vx,128]`.
2. **Aggregations take a FIELD, not an expression** ⇒ the reversal delta must be
   materialized into ball fields (`dl`,`dr`) before a paddle can aggregate it.
3. That materialization costs a **2-tick contact→reversal lag**.
4. A **direction gate** (`where vx<128`) is load-bearing to stop the stale delta
   double-firing — a trap, not a design.

## Hypotheses

- **H1 (signed fields):** allowing `range:[lo,hi]` with `lo < 0` (Int8/16/32 pools)
  removes encoding 1 outright, with NO change to the range proof (it already compares
  `v < range[0] || v > range[1]`, sign-agnostic) and no change to determinism
  (integers throughout). Negation becomes `sub:[0,vx]`, which the proof passes
  trivially because `[-8,8]` negates to `[-8,8]`.
- **H2 (multiply):** adding `{mul:[a,b]}` gives branchless conditionals —
  `vx + count_of_paddles_near * (-2*vx)` — which collapses encodings 2-4 into ONE
  rule with NO helper fields, NO lag, and NO direction gate. Multiply is total,
  deterministic, and interval-provable (4 corner products), so it costs the grammar's
  safety properties nothing: loops/RNG/hidden state remain unrepresentable.
- **H3 (leak):** signed pools or multiply break something measured — range proofs,
  fold semantics (`max`/`min`/`additive` over negatives), persistence round-trip,
  the wire's `FIELD_SPEC`, or the RD-025 grid (which assumes non-negative coords for
  its cell keys).

## Bars (pre-registered)

1. **Compatibility:** all 16 suites pass UNMODIFIED.
2. **Authorability (the point):** Pong rewritten NATURALLY — signed velocity, no
   offset encoding, no materialized deltas, no lag, no direction gate — and the
   EXISTING `pong_test.js` behavioral assertions still pass against it (same game,
   same oracle). Report the delta: rule count and encoding count, v1 vs v2.
3. **Proof intact:** an unprovable multiply (`vx*vx` into a small range) is REFUSED
   `range_unprovable`; a signed underflow (`sub:[lo,1]` below range) is REFUSED; a
   too-wide signed range is refused at `defineType`.
4. **Sign safety:** negative values survive save/load byte-identically; folds
   (`min`/`max`/`additive`) behave correctly over negatives; the RD-025 grid still
   works when coordinates are declared signed (or is honestly restricted).

## Decision rule

- Bars 1-4 pass → **DECIDED**: signed + multiply land; the ladder's authoring gap
  closes; RD-027's encodings become history rather than folklore.
- Bar 2 passes but the natural rules are still contorted → the residual encodings are
  named and a sugar/desugar card opens (e.g. expression-valued aggregations).
- Bar 3 or 4 fails → **H3**: report the leak; signed and multiply are independent, so
  ship whichever survives and record why the other did not.

## Out of scope

Floats (RD-030's determinism policy owns that); expression-valued aggregations unless
bar 2 shows multiply was insufficient; division (unprovable-by-zero, and no measured
need).
