# H-INFO — freeze the information-preservation hypothesis against a shallower rival (2026-09-21)

## The hypothesis

**H-INFO.** Let the real state be `s ∈ S` and let a verifier observe `r = f(s)`. The observation
partitions `S` into equivalence classes. A proposition `P` may be entitled by `r` **only if**

    f(s₁) = f(s₂)  ⇒  P(s₁) = P(s₂)

i.e. only if `P` is invariant across every set of states the representation makes observationally
equivalent. **Entitlement is preserved across a transformation only for propositions whose
relevant distinctions are preserved by that transformation.**

## The materially shallower rival, named so the test can discriminate

**H-RICH.** The failures in this branch came from representations that were **too coarse** — a
single boolean carrying too much. A richer representation, with more distinct values, supports
more entitlement.

H-RICH explains the whole history as well as H-INFO does: every failure so far involved a
2-valued return. **A prospective test that both predict equally is worth nothing here**, which is
what step 15 taught. So the test must be where they diverge.

## Where they diverge

H-INFO says what matters is whether *the specific distinction `P` depends on* survives — not how
many values the representation has. H-RICH says richness itself buys entitlement. So:

    R_rich   MORE distinct values, but collapses the distinction P needs
    R_poor   FEWER distinct values, but preserves exactly the distinction P needs

## The construction

    S = { SUPPORTED, UNSUPPORTED, UNVERIFIABLE }
    P(s) = "glyph inspection completed"  =  (s != UNVERIFIABLE)

    R_rich : SUPPORTED -> "ok"          UNSUPPORTED -> "missing:1" / "missing:2" / "missing:3+"
             UNVERIFIABLE -> "ok"
             4 distinct values; P is NOT invariant on the class {"ok"}

    R_poor : SUPPORTED -> True          UNSUPPORTED -> True         UNVERIFIABLE -> False
             2 distinct values; P IS invariant on both classes

`R_rich` is strictly richer by value count and strictly worse for `P`. That is the whole point.

## Measurement

For each representation, a witness is any predicate over the representation alone. Entitlement to
`P` is tested by the frozen procedure already in use: produce each state by intervention, confirm
`realizes(I, state)`, and ask whether **any** witness over that representation separates the
`P`-true states from the `P`-false state.

    entitlement holds   iff  some witness over R distinguishes {SUPPORTED, UNSUPPORTED}
                             from {UNVERIFIABLE}

This is decidable by enumeration: if two states in different `P`-classes share a representation
value, no witness over `R` can separate them, and the answer is no.

## Predictions — opposite by construction

**G1.** Under `R_rich`, entitlement to `P` **FAILS** despite 4 distinct values.
    H-INFO predicts FAILS. H-RICH predicts SUCCEEDS (richer representation).

**G2.** Under `R_poor`, entitlement to `P` **HOLDS** despite only 2 values.
    H-INFO predicts HOLDS. H-RICH predicts FAILS (poorer representation).

**G1 and G2 together are the discriminating pair.** Either one alone is weak; both are needed,
because a single result could be explained by an unlucky construction.

    G1 FAILS and G2 HOLDS   H-INFO discriminated from H-RICH; the hypothesis earns standing
    G1 SUCCEEDS and G2 FAILS  H-RICH is the better account and H-INFO is wrong
    any mixture              neither discriminated; no standing for either

**G3 (must-fire control).** Under the *actual* shipped representation, entitlement to `P` fails —
reproducing the real font case. If this does not reproduce, the measurement is broken and G1/G2
may not be read.

## Rules

H-INFO earns **standing as the better of two stated accounts on this construction** and nothing
more — not a law, not a name, not a place in any architecture. Specificity and coverage remain
**outside** the model as hypotheses from X1/X2; they are not folded in here. If the measurement
cannot evaluate a criterion exactly, that is an apparatus failure, scored as such, never as
evidence about either hypothesis.
