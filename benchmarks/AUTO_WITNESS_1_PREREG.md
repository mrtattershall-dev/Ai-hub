# PREREGISTRATION — AUTO-WITNESS-1, and typed outcomes as substrate

Frozen before the mechanism exists. Nothing else is in this commit.

## The milestone, in the owner's words

> Given an authority-bearing transformation that executes during an existing test or benchmark,
> LegaScreen can automatically capture enough upstream construction history to reproduce the same
> legitimate invocation **without a hand-written driver**.

That is the whole of this slice. No judgment, no invariants, no contract source, no discovery of the
authority surface, no perturbation. Those are AUTO-CF-1 and later.

## What I am claiming is wrong with what exists

Slice 2's driver is 12 lines of my own judgment about what `calculus.derive`'s pre-authority facts
are. It is the reason the sound method covers one transform, and writing 250 more would not be
progress - it would be 250 more chances for the screen author to decide what the subject means. The
bottleneck is not invariants. It is the automatic construction of a legitimate experiment.

## Mechanism (named now so the predictions are falsifiable)

An ES module namespace is immutable from outside, so an already-written test cannot be intercepted by
assignment. A **module loader hook** substitutes, for a named module, a shim that re-exports the raw
module and wraps the configured exports. The existing test imports what it always imported and calls
what it always called; the wrapper records and delegates.

    existing test  --imports-->  [shim]  --delegates-->  real calculus.mjs

A recorded call becomes a node. An argument is classified by **identity**, not by name or shape:

    DERIVED   the object IS the return value of a recorded call   -> replay that call
    LEAF      plain data                                          -> the mutable surface

Replay re-executes the DAG bottom-up through the same production functions.

## PREDICTIONS

**W-1 (DECISIVE). Zero hand-authored drivers.** Running an *existing* test file under the loader
captures at least one complete construction DAG for a `calculus.derive` call, whose interior nodes
are real `observe` calls and whose leaves are raw facts. No file under `benchmarks/` or `legascreen/`
supplies `facts`, `construct` or `operate` for that call.
*Falsified if* capture needs a driver, or if the target call is captured with its inputs opaque -
i.e. no upstream history, which is the thing being built.

**W-2. Replay is semantically equivalent, or nothing is scored.** Re-executing a captured DAG
reproduces the original call's observable authority map exactly. Any divergence yields
`BASELINE_UNREPLAYABLE` and the witness is unusable, not "mostly usable".

**W-3. The brand survives recording.** A replayed premise satisfies the target's own `isAuthority`,
and `derive` accepts it. A recorder that deep-clones its arguments destroys membership in the
module-private WeakSet - this is the slice-2 lesson at a new layer, and it is the most likely way for
this slice to fail.

**W-4. Raw facts are distinguishable from derived objects, and a token is never a leaf.** Every
captured argument is LEAF or DERIVED. A branded token classified LEAF would invite mutation of an
authority object, which is the forgery this whole line of work exists to avoid.
*Control W-4b (must fire):* an unbranded object of the same SHAPE as a token is a LEAF, and is not
replayed as a call. Shape must not be a proxy for identity.

**W-5. A violation verdict is UNREACHABLE without the full journey - structurally, not by
convention.** The substrate refuses to return `INVARIANT_VIOLATED` unless the recorded path contains
BASELINE_REPLAYED, PERTURBATION_APPLIED, a legitimate reconstruction, the target reached, and the
output observed.
*Control W-5b (must fire):* a probe that attempts to return VIOLATED from an incomplete journey is
refused BY THE SUBSTRATE. If it can be talked into it, the state machine is decoration.

**W-6. Dependency edges are recorded by identity.** The target node's premise edges point at the
`observe` nodes that actually produced those objects. Any edge derived from a name or a shape is a
defect, not an implementation detail.

**W-7. No backdoor.** The witness substrate exports no mint, forge, or test-only constructor, and the
instrumentation only wraps and delegates. Asserted mechanically, as in CF-4.

**W-8 (PREDICTION OF NO DETECTION). This slice finds nothing about the repository.** It adds no
judgment. If a run produces a finding about the subject, the finding is an artifact of the
instrument and must be treated as such.

## CONTROLS THAT MUST FIRE

    W-3b   no forge: the exported surface is pinned by a test
    W-4b   a token-SHAPED unbranded object is a LEAF
    W-5b   an incomplete journey cannot yield VIOLATED
    W-2b   a non-deterministic target yields BASELINE_UNREPLAYABLE and scores nothing

## WHAT THIS SLICE DOES NOT ESTABLISH, STATED BEFORE THE RESULT

- **No coverage fraction will be reported.** The authority surface has not been discovered. 1/251 was
  a fraction over a surface I never established; replacing it with a better-looking fraction over the
  same unestablished surface would be the same error. Counts only, until DISCOVER exists.
- No perturbation, no counterfactual, no support formula, no contract source. `declared` remains
  human testimony and is not consulted here.
- Nothing about transformations that do not execute during an existing test.
- The five prototypes are NOT merged. The correct common abstraction is not yet known, and merging on
  accidental similarity would freeze it.
