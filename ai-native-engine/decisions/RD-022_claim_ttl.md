# RD-022: Claim TTL + disconnect (Closed) — a bounded lease, and disconnect is distinct from timeout

**Question:** Open since RD-002 ("expiry tuning, what happens if the claiming
player drops"), and owner of the reload-releases-claims semantic RD-B6.1
pinned. Two halves: (Q1) what bounds how long a vanished actor can deny an
entity at the claim layer, and what shape should that bound take? (Q2) Is a
disconnect the same thing as a timeout, or does it need its own mechanism?

**Decision:**
1. **Hard TTL cap, enforced by REJECTION** — `claim.ticks` must be a positive
   integer ≤ `CLAIM_TTL_MAX` (64; per-instance override `engine.claimTtlMax`).
   Enforced twice per the RD-018 split: the wire rejects with localized codes
   (`claim_ticks_invalid` / `claim_ttl_cap`, detail text teaches renewals);
   the engine validate layer is the backstop for in-process callers (whole-tx
   rejection, zero footprint). Never clamped (see rivals).
2. **Long holds are RENEWALS** — the holder re-claims while it still holds the
   entity (measured legal, no privileged path, each renewal itself capped).
   Renewal requires the actor to be alive: exactly the liveness signal a TTL
   exists to extract. Tenure while alive is unbounded (measured: B blocked
   100/100 across ~150 ticks); tenure after vanishing is ≤ cap−1 submits.
3. **Disconnect is DISTINCT from timeout** — `engine.releaseActor(actor,
   {graceTicks})`. Grace behaves as if the claim were re-claimed with
   `ticks=graceTicks` at the release tick, except release can only SHORTEN a
   hold (`Math.min`), never lengthen. `graceTicks:0` = immediate release.
   Reload remains "releaseActor of everyone, grace 0" (RD-B6.1 pinned semantic,
   re-asserted here for graced claims through save/load).

## What the probe found BEFORE the fix (the boundary, silently broken 6 ways)

Every one of these **committed with zero reasons** (scratch probe, reproduced
as NC/T cases in `experiments/032_claim_ttl/claim_ttl.js`):

| input | silent behavior |
|---|---|
| `ticks:1e9` | B denied **1000/1000** submits — unbounded denial-of-progress, reachable through the wire (any positive integer passed) |
| `ticks:NaN` | `until = NaN` fails BOTH comparisons: never blocks (useless to its author) **and never swept** — permanent zombie map entry |
| `ticks:Infinity` | blocks forever, never swept — the stale claim that should expire and doesn't |
| `ticks:'5'` | `until = 1 + '5' = '15'` (string); the block/sweep comparisons coerce `'15'`→15, so a 5-tick claim silently blocks 13 ticks (2..14 at grant tick 1) — measured, `scratchpad/confirm_ttl.js` |
| `ticks:0 / -1` | lease already expired at grant — a committed no-op |
| claim on a deleted target | committed, **no claim placed** — the author believes it holds what it does not |

Also pinned (legal, not a bug): the lease span is inclusive of the granting
tick — `ticks:n` protects exactly **n−1 subsequent submits**, so `ticks:1`
protects nothing. Documented, not rejected (refusing a harmless legal value is
policy, not safety); "cover my next tick" is `ticks:2`.

## Rivals

**Q1 cap shape — CLAMP vs REJECT** (the RD-018 free-form clamp lesson retested
at the claim layer). CLAMP (truncate 1e9→64, commit) bounds the denial but
destroys the AUTHOR'S MODEL: the claim commits with zero signal, the author
schedules no renewal ("I hold it forever"), and at cap expiry the entity is
silently up for grabs — measured: B takes it, and A's next act on "its" entity
is the FIRST signal, arriving after the damage (T4). That is the D&H shape
applied to coordination state. REJECT converts the future silent surprise into
an immediate repairable error whose text carries the fix ("a long hold is
expressed as RENEWALS") — RD-018.1's error-text-specificity finding applied.
**CLAMP inadmissible; REJECT wins.** NO-CAP is NC1: unbounded denial.

**Q2 disconnect — TTL-ONLY vs IMMEDIATE vs GRACE**, measured on one scenario
(A claims ticks:8, starts a 3-step multi-tick harvest, disconnects after step
1; VANISH = never returns, BLIP = returns 2 ticks later):

| rival | BLIP (transient drop) | VANISH (denial horizon) |
|---|---|---|
| TTL-ONLY (no release) | safe — A resumes and completes | **full remaining TTL** (measured 6; worst case cap−1 = 63) |
| IMMEDIATE (`grace:0` at disconnect) | **BROKEN** — interloper claims at +1; A's return is rejected `held by B`; crop stranded half-harvested (A's step-1 growth + B's write). Per-tick txs were atomic; the multi-tick INTENT was the thing the claim protected, and it wasn't | 0 (best possible) |
| GRACE (`graceTicks:4`) | safe — interloper blocked in-window, A re-claims and completes | ≤ grace (measured 3 = grace−1, same span rule) |

**GRACE dominates**: bounded denial ≪ TTL horizon AND blip-invisible.
So disconnect IS distinct from timeout — timeout is the backstop for actors
nobody noticed vanish; release-with-grace is the fast path when the session
layer KNOWS. Grace SIZE is per-game policy (engine ships the mechanism).

## Negative controls (the guard is load-bearing)

- **NC1 cap off** (`claimTtlMax = Infinity` — the override doubles as the
  control knob): `claim{ticks:1e9}` commits, B denied 1000/1000.
- **NC2 the stale claim that should expire but doesn't**: direct-set the exact
  pre-fix map states — `until:NaN` never blocks and survives 500 expiry sweeps
  (leak); `until:Infinity` blocks 500/500. Both now unrepresentable through
  `submit()` (rejected, zero footprint).

## Determinism + composition (measured)

- **T9 (RD-003/P1)**: a batch mixing valid claims, an over-cap claim, an
  invalid-ticks claim, contested writes, then a graced release — committed
  signature AND claims-map signature identical across 6 seeded permutations.
- **Fuzz**: `experiments/024_concurrency_fuzz/fuzz.js` now generates claim
  TTLs from {valid, cap-edge 64/65, NaN, Infinity, 0, 1e9, '5'} as a PERMANENT
  arm — green at 3,000×seed 1 + 2,000×seed 7 (P1–P6 incl. reload-fork).
- **Undo**: reverses the DATA of a claim-carrying tx, not the claim — claims
  are session state, never history entries (T8, pinning the RD-020 policy).
- **Reload**: releases ALL claims including mid-grace ones (T8; RD-B6.1 T6c
  extended). **Tombstoned rows**: a claim may briefly outlive its entity; the
  expiry sweep reclaims it — rows are never reused, so no aliasing window.
- `releaseActor` is a trusted API (like `spawn`): invalid `graceTicks` throws;
  unknown actor / double release are 0-affected no-ops.

## Files

- `core/engine.js` — claim branch in the validate fixpoint (absence via
  RD-004.6 resolve, same-batch-delete check, integer + cap validation),
  `releaseActor(actor, {graceTicks})`, `CLAIM_TTL_MAX` exported.
- `core/protocol.js` — `claim_ticks_invalid` / `claim_ttl_cap` localized
  codes; absent ticks → documented default 3 (unchanged); cap follows
  `engine.claimTtlMax`.
- `experiments/032_claim_ttl/claim_ttl.js` — 56 assertions, ALL PASS.
- Full regression green: 8 core suites + 024 (both seeds) + 026/027/029/030/
  031/033; 021 standalone unaffected.

## Transferable principle

A coordination lease has TWO expiry questions, not one: "how long may it
live?" (cap, enforced by rejection so the author's belief can never silently
diverge from the world) and "what happens when its holder vanishes?" (release,
with a grace window because the session layer's knowledge — disconnect — is
faster but less certain than the engine's — timeout). And validate the VALUE,
not just the presence, of anything that feeds arithmetic on a deadline: NaN
passes every `<=`/`>` guard by failing all of them.

## What remains open

- Nothing engine-side. Grace SIZE tuning (and who calls `releaseActor` — a
  session/presence layer) belongs to the future editor/game shell.
- `ticks:1` protecting nothing is pinned + documented; revisit only if authors
  measurably trip on it (would be a span-semantics change, not a guard change).
