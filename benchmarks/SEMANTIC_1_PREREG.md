# PREREGISTRATION — SEMANTIC-1. Two tracks, kept apart: producer semantics and consumer semantics.

Frozen before the mechanism exists. Nothing else is in this commit. Builds on `3c536cb`.

## What SURFACE-1 changed

    production paths consuming the authority calculus: 0

The repository is case **B**: the calculus is an executable specification, not the production
authority substrate. **This slice does not touch that.** Wiring the calculus into production to
improve the screen would contaminate the architecture and would build software that is easy for its
own scanner to read rather than a scanner that reads software. If Legasus independently wants the
calculus as an enforcement boundary, that is a separate question with separate evidence.

## The three roles, discovered rather than named

SURFACE-1 found that reading authority coordinates off an output cannot screen a predicate. The
roles are distinguished mechanically from witnesses - what a call CONSUMED and what it PRODUCED,
asked of the subject's own brand predicate:

    PRODUCER     consumed no authority, produced authority        facts -> authority
    CONSUMER     consumed authority, produced none                authority -> decision/effect
    TRANSDUCER   consumed authority AND produced authority        authority -> authority

No name, no vocabulary, no list.

## ONE EXPERIMENT, DIFFERENT OBSERVERS

The two tracks share the AUTO-CF-1 experiment - baseline, witness, intervention, legitimate
reconstruction - and differ only in what is read off the end. The observer becomes a parameter.

    SUPPORT observer    authority coordinates of the output    -> Track P
    DECISION observer   the output value itself                -> Track C

**The tracks are kept separate and no claim is made that they are one invariant.**

## TRACK P — producer/transducer semantics

**P-1. A support formula is inferred from counterfactual cells, with a tiny vocabulary.**
`ALL_OF`, `ANY_OF`, `NTH(i)`, `CONSTANT`, `UNKNOWN`. Inference, name-free:

    every construction node has a leaf whose removal changes the coordinate   -> ALL_OF
    exactly one node does                                                     -> NTH(i)
    no single leaf changes it, but removing ALL leaves does                    -> ANY_OF
    no single leaf changes it, and removing ALL leaves does not                -> CONSTANT
    any required cell unmeasurable, or a partial cover of nodes                -> UNKNOWN

**UNKNOWN is always available and is never a failure state.**

**P-2. A contract is an evidence object, not a string.** `subject`, `proposition`, `authority`
(source, provenance, version, validAgainst) and `status` of ESTABLISHED / UNKNOWN / STALE.

**P-3 (ANTI-SELF-RATIFICATION, MECHANICAL). `validAgainst` pins the contract to a state.** It carries
a digest of the subject module. If the module's current digest differs, the contract is **STALE** and
**cannot convict or absolve** - the result is CHARACTERIZED. An implementation and its criterion
cannot be edited together into a green result, because editing the implementation invalidates the
criterion by construction.
*Control P-3b (must fire):* mutate the subject's bytes, and a previously convicting contract must
stop convicting.

**P-4. No contract means CHARACTERIZED, never DEFECT.** An observed relation with no established
contract is recorded as behaviour. The screen does not invent requirements.

**P-5 (THE MILESTONE). At least one MECHANICALLY DISCOVERED transform goes
DISCOVERED -> WITNESSED -> COUNTERFACTUALIZED -> CONTRACT-RESOLVED -> SCREENED with no hand-written
driver.** "Human points to function" leaves the pipeline.
*Stated plainly:* the CONTRACT is still human testimony. What disappears is the driver, not the
criterion. A contract carrying provenance is legitimate; a hand-authored `facts`/`construct`/
`operate` is not.

## TRACK C — consumer semantics

**C-1. The experiment perturbs an authority input and observes the DECISION.** Reported as
`DECISION_CHANGED` / `DECISION_UNCHANGED` with both values. The screen does not label either value
"permitted" - it has no way to know which is which, and inventing one would be a convention.

**C-2 (THE CONTROL THAT STOPS "ALWAYS REFUSE" FROM WINNING). A positive case is required.** At least
one consumer case where a legitimately weakened authority input must leave the decision UNCHANGED,
because the removed coordinate is irrelevant to it.
*Falsified if* every consumer perturbation changes the decision, which would mean the screen cannot
distinguish a necessary coordinate from any coordinate at all.

**C-3. Consumer necessity is a contract proposition too.** `REQUIRED` (removing it must change the
decision) or `IRRELEVANT` (it must not). Same evidence object, same STALE rule, same CHARACTERIZED
fallback.

## SURFACE addendum

**S-8. Module-resolution completeness becomes an explicit coordinate**, not an absence:
`STATIC_LINKED` / `DYNAMIC_LINKED` / `RUNTIME_ONLY` / `UNRESOLVED`. A dynamic import whose target
acorn cannot establish is UNRESOLVED. **The report should look gray, not green.**

## WHAT THIS SLICE DOES NOT ESTABLISH

- **No backward/sink discovery.** Finding candidates by causal position - effect sinks and the
  control dependencies that gate them - is the larger next problem and is NOT in this slice. The
  surface therefore remains one-directional and incomplete, and CAVEAT still stands.
- No merging of the five prototypes.
- No claim that producer and consumer screening are one invariant.
- **The calculus is not wired into production.**
- If P-5 lands, the honest count becomes "transforms screened" > 1. "Previously unknown repository
  defects discovered" is expected to stay 0, and a finding against an ESTABLISHED contract would be
  a surprise, reported as such rather than as a success.
