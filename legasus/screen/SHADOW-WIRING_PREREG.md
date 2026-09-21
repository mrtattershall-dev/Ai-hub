# Shadow wiring of the entitlement gates — frozen 2026-09-21, before any run

## Where the gates go, and where they do not

    LegaScreen  ->  raw observation + evidence record  ->  candidate claim
                                                                |
                                            [ O | D | M ]  entitlement gates
                                                                |
                                                  strongest licensed claim
                                                                |
                                                  EntitlementCertificate
                                                                |
                                              legaknow mints authority
                                                                |
                                                        downstream action

**Not** into candidate detection. The screener stays noisy; discovering candidates is what it is
for. It does not own the semantic strength of the conclusion drawn from them.

**Not** authoritative itself. A passing gate vector produces a *certificate*, which is a
prerequisite for minting. Authority semantics stay in `legaknow` and are not duplicated here.

## Topology found before writing this, and it changes the plan

`legaknow` is **JavaScript**, in the `ai-coding-hub-indent` worktree on branch
`fix-tolerant-indent`. This session's `legasus/screen` is **Python**, on `fix/unverified-finish-
recorded`. The two do not coexist on any branch. **Merging them is tatte's decision, not mine.**

More importantly, `legaknow/monotonicity.mjs` **already states the law**:

> *"AUTHORITY CANNOT BE CREATED BY DESTROYING INFORMATION."*
> *"A transformation may discard information only if the discarded distinction cannot change
> downstream entitlement."*

and its header records four defects of exactly the false-merge family this session rediscovered,
including the observation that *"the downstream reasoning was CORRECT and the conclusion was
unjustified"* — the site #7 shape, reached independently from the other direction.

So the bridge is not a new law. It is a connection to an existing one, and the shadow run tests the
connection.

## The claim under test, which conformance did NOT establish

> Wiring the gates into real LegaScreen output **preserves legitimate conclusions while preventing
> unsupported ones.**

## Preregistered outcomes

**W-1 DETECTOR INVARIANCE.** Wiring changes candidate generation by **zero**. If observation moves,
the authority layer has contaminated it.
FALSIFIER: any change in the candidate set.

**W-2 ANTI-REFUSAL.** At least one fully supported claim remains mintable. A perfect refusal machine
fails this.
FALSIFIER: zero claims mintable across the corpus.

**W-3 MONOTONIC NARROWING.** Removing evidence may preserve or reduce the emitted claim's authority.
It may **never** strengthen it.

    Authority(E_{n+1})  ⊆  Authority(E_n)

FALSIFIER: any degradation step that yields a stronger licensed claim. This is the direct connection
to `monotonicity.mjs` and **if it fails the bridge is architecturally wrong**, not merely buggy.

**W-4 NO SILENT DROP.** Every gate failure yields either a narrower licensed claim or an explicit
unresolved frontier. Never disappearance.
FALSIFIER: a refused claim that produces neither.

**W-5 NO CAUSAL LABELLING.** Multi-gate failures stay vectors. No field, output or log names a cause.
FALSIFIER: any scalar cause reaching the certificate.

**W-6 FALSIFIER LIVE.** A demonstrably wrong conclusion with O, D and M all passing is surfaced as a
missing-gate candidate, not rationalised.
FALSIFIER: it is absorbed silently.

## The degradation chain for W-3

    E0  full record
    E1  reachability evidence removed
    E2  discriminating positive control removed
    E3  a required premise opened

Required: the licensed claim's authority rank is non-increasing along `E0 → E1 → E2 → E3`. Rank is
ordered by `(form strength, scope breadth)` and frozen before the run.

## Rules

Shadow mode: nothing downstream consumes the certificate, and no detector is modified. The other
worktree is **not written to**. `reach1.py` and `hadmission.py` stay unchanged; census sites #7 and
#10 stay unrepaired. If W-3 fails, that is reported as an architectural refutation of the bridge and
the wiring is not proposed for production.
