# TEST-(-1) — frozen definition, before any bridge is built

**Date:** 2026-09-29 · **Status:** FROZEN, NOT RUN. No bridge exists yet; this is written first so the
target cannot be adjusted to whatever the first assembly happens to do.

## Why this precedes PRODUCT-0

PRODUCT-0 is a game: build → shutdown → restart → add a feature → preserve earlier behaviour. That is
the product milestone, and it is the wrong first test of the **governance** bridge, because a failure
in it could be the model, the game, the increment chain, the restart, or the bridge — and nobody could
say which.

TEST-(-1) is **one file, one ordinary user-started hub, one trivial legitimate modification.** Not a
game. Its entire purpose is to establish whether the claimed path is the path that actually executes.

## What must be true before it can run

An ordinary hub, started the ordinary way (`start-hub.bat` → `npm start`). **Not** a benchmark
launcher, **not** a `*-child*` harness, **not** a test runner. If the run requires an environment a
user would not have, TEST-(-1) has not been run — it has been simulated, and this project already has
a name for that error.

## The claim

For one trivial legitimate edit, the executed path is:

```
OBSERVE → ADMIT → AUTHORITY → PROPOSE → GOVERN → EFFECT → VERIFY → RETAIN
```

and each transition leaves evidence that it actually occurred, distinguishable from evidence that it
was merely declared.

## The five worlds

One passing world is not a test; it is a demonstration. The refusals are the point, and each must
refuse **at its own layer** and be **attributed to that layer** in the record.

| # | world | expected | the failure it rules out |
|---|---|---|---|
| 1 | evidence insufficient | **ADMIT refuses.** No authority is minted, no proposal reaches an effect. | admission is decorative — something downstream proceeds without an admitted fact |
| 2 | admitted fact, no authority | **the effect refuses.** The fact exists; nothing licenses acting on it. | an admitted fact is silently treated as permission |
| 3 | authority exists, target outside its scope | **GOVERN refuses.** Bytes unchanged. | scope is recorded but not enforced |
| 4 | authority + scope valid, destructive candidate | **preservation refuses or restores.** | governance passing is mistaken for the change being safe |
| 5 | everything valid | **bytes actually change**, and the receipt names what landed | the whole thing is a refusal machine that can never say yes |

**World 5 is the positive control and runs first.** Worlds 1–4 mean nothing without it: a bridge that
refuses everything would pass all four and look like a triumph.

## What counts as a composition failure, declared in advance

These are expected. A first assembly that fails here is a **useful** result, not a setback:

- **identity disagreement** — `workspaceStamp()` (path:size:mtime) and `revisionOf` (sha256 content)
  give different answers for the same target. Named in the manifest as the highest-risk row.
- **refusal invisible upstream** — a layer correctly refuses and the controller reports success, or
  reports the refusal as a different layer's.
- **misattribution** — governance and preservation both refuse correctly, and the record credits the
  wrong one.
- **lineage loss across persistence** — a restart recovers the run but not the evidence that
  entitled it, so a resumed run continues on authority it can no longer justify.
- **admitted-but-unused** — ADMIT produces a fact and nothing downstream consumes it, which is
  today's flag-dead pattern surviving the bridge.

## What TEST-(-1) does NOT establish

That Legasus improves anything. That the architecture is worth its cost. That a game can be built.
It establishes exactly one proposition: **the governance path a user's run actually takes is the path
the architecture claims** — or it identifies precisely where the two diverge.

## Recording rules

- Composition status starts **UNESTABLISHED** and is not inherited from any component's green suite.
- Each world records which layer refused, from that layer's own output, never inferred from the
  outcome.
- A world that could not be run is `NOT_EVALUATED`, never a pass.
- No environment variable may be set for this run that a user's ordinary launch would not set. If one
  is required, that is a finding to record, not a step to take.
