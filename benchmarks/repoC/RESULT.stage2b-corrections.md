# Repo C — stage 2b: corrections to the stage 1–2 record

Three claims in `RESULT.stage1-2.md` were aggregations that had not been individually established, and
one interpretive claim was simply wrong. Verified per-example rather than defended.

## CORRECTION 1 — "41.1% coverage bounds CAPABILITY and COMMIT PRECISION" is WRONG

It bounds **reach and recall**. It does **not** upper-bound precision, which is conditional:
`correct commits / all commits`. A system could observe 41.1% and be 100% precise on the small subset it
commits — a combination that would look impressive and mean something very different from competence.
The four measurements stay separate for exactly this reason.

## CORRECTION 2 — the denominator, reconstructed mechanically

    mined by r3                     182 runs
    distinct (module|source) keys   157
    keys carrying >1 run             19, covering 44 runs

The stage 1–2 contingency table matched r3 **runs** against a `Map` of **distinct external keys**, so a
single external verdict could be reused by several r3 runs. The `180` was runs-that-found-a-key, not
independent comparisons. **44 of 182 runs sit under a duplicated key.** This is a real weakness in that
table and it is disclosed, not smoothed. The same non-unique-key weakness was recorded on `packaging` at
4/159; here it is 19/157.

## CORRECTION 3 — claim 1 was nearly right, and "43" was the wrong number

Per-example probe of all **50** unobservable runs:

    emits stdout, chain applies      48
    SILENT, chain does NOT apply      2
    unattributable                    0

The two silent cases fail for other reasons (`ParseException`, `NameError`). So the stdout-corruption
chain explains **48 of 50**, not "the 43". The earlier figure conflated *unobservable ∧ externally-passing*
with *caused by stdout*. Both numbers were real; the inference joining them was not.

## CORRECTION 4 — the eight "miscalibrated refusals" are something more precise, and worse in a different way

Reason-topology check on all 57 `SETUP_FAILED` runs:

    an EARLIER example in the same docstring ALSO fails externally   57/57
    no earlier failure (reason unsupported)                           0
    SETUP_FAILED with empty setup (impossible reason)                 0

**r3's stated reason was correct every single time.** A preceding example really did fail. What r3 got
wrong in the 8 `SETUP_FAILED | PASS` cases was the **inference from that reason**: r3's execution model
requires setup to succeed, so it concludes the example cannot become an experiment. doctest continues
after a failure over shared globals, and those 8 examples ran and passed anyway.

So the frozen protocol's wording — *"is the stated reason supported by the external evidence?"* — admits
two readings, and both are reported rather than the flattering one being chosen:

    REASON calibration        57/57 = 100%   the diagnosis was right
    CONSEQUENCE calibration   49/57 =  86%   the inference drawn from it was wrong 8 times

This does **not** let r3 off. A false claim is still a false claim, and 8 examples were declared
non-experiments while an external verifier ran them successfully. But the failure is located differently
than first reported: **not a wrong diagnosis, a wrong entailment from a right diagnosis** — and it is the
same execution-model divergence (per-example replay vs docstring-sequential shared globals) that was
identified on `packaging`, now producing a false claim rather than a scope mismatch.

## CORRECTION 5 — scope of "the epistemics held"

Split, as it should have been:

    SAFETY epistemics       49/49 unavailable observations became UNOBSERVABLE, never an admission
    DIAGNOSTIC epistemics   8/57 consequence errors

The authority consequence was conservative. The description of reality was sometimes wrong. The whole
point of freezing reason-level calibration was to stop the former laundering the latter, and here it did
exactly that job.

## CORRECTION 6 — aliasing, stated at the width the evidence supports

157 observed code-object identities map onto 78 `(module, co_name)` keys, so **≈50.3% of observed
identities lack a unique representation under that scheme**. That is *not* the same as half of executed
behaviour, sites, or claims being conflated — frequency and authority-relevance are unmeasured. The raw
result is already sharp enough without inflation.

## CORRECTION 7 — the two stdout events are not independent evidence

The selection-apparatus pollution and the r3 observer pollution occurred in closely related Python
execution environments, and awareness of the first preceded diagnosis of the second. Chronology is
recorded; they are **not** treated as two independent confirmations. The more useful reading: the class
was known, had already been repaired in the apparatus, and remained latent across a frozen authority
boundary — which is why knowing about a bug class is weaker than mechanizing the invariant everywhere it
applies.

## What stands unchanged

    COVERAGE   74/180 observable — the reach failure is real
    the stdout-channel assumption was undocumented and unexercised by the development corpus
    UNOBSERVABLE never became an admission
    none of this is repaired; it belongs to r4, which requires Repo D

## CORRECTION 8 — the consequence-calibration figure, stated as an epistemic state rather than an interval

Written later as `49/57 +/- 1`, which implies symmetric statistical uncertainty. It is not that. Three
external keys are ambiguous (the same `module|source` in two docstrings with different outcomes, resolved
by a last-wins map), and exactly one member of the `SETUP_FAILED | PASS` cohort sits on one. Resolving
that identity can only move the case from *wrong* to *correct*, never the reverse.

The honest report is therefore not a ratio at all:

    49  supported agreements
     7  supported disagreements
     1  UNRESOLVED ATTRIBUTION - identity collision, cannot support either classification

Forcing the unattributable observation into a 57-case binary denominator is precisely what the algebra
argues against: an observation that cannot be bound to a subject is not evidence about that subject.
