# H-NEUTRAL result — NOT DISCRIMINATED. Neutrality is not the property that matters.
2026-09-21. Preregistration `H-NEUTRAL_PREREG.md` (ae9794b), frozen before construction.
Raw: `legasus/out/hneutral/result.json`. Stage A, author-built, weak by design.

## A preregistration defect, found while building and resolved before measuring

The prereg defined detection distance against "the failure-free baseline" without saying which:

    ORACLE    the same run in which the failing operation SUCCEEDS and contributes its real value.
              Requires a counterfactual that by construction was never computed.
    OBSERVER  the set of stage outputs producible by ANY failure-free execution. Detection means
              the observed output lies outside that set.

**Both were measured and both are reported.** Choosing the favourable reading after seeing the data
is the apparatus failure this branch has committed six times. It mattered: **the two readings give
opposite verdicts on N1 and N2.**

## Results

    pipeline  arm                    value          neutral?  oracle  observer
    list      neutral                []             True      1       INF
    list      non-neutral            ['__ERROR__']  False     1       1
    list      exploratory-in-domain  ['a']          False     1       INF
    numeric   neutral                0              True      1       INF
    numeric   non-neutral            999999         False     1       1
    numeric   exploratory-in-domain  5              False     1       INF
    conj      neutral                True           True      INF     INF
    conj      non-neutral            False          False     1       INF
    string    neutral                ''             True      1       INF
    string    non-neutral            'ERR'          False     1       1
    string    exploratory-in-domain  'a'            False     1       INF
    index     neutral                []             n/a       1       1     raised IndexError
    index     non-neutral            ['__ERROR__']  n/a       1       1

Neutrality was **computed** from the algebra (`x ⊗ v = x` over a sample domain), never assumed, and
asserted to match every frozen label.

## Scoring — neither reading satisfies the disposition

    ORACLE     N1  1/4   FAILS      N2  4/4  holds      N3  FAILS (1 vs 1)
    OBSERVER   N1  4/4   holds      N2  3/4  FAILS      N3  holds (INF vs 1)

The prereg required N1, N2 **and** N3. Neither reading delivers all three.

> **H-NEUTRAL is NOT DISCRIMINATED.**

Under the ORACLE reading the measurements are essentially flat — every coercion is visible at stage
1. By the prereg's own third disposition, that makes **H-TOTAL and H-INFO the better accounts**.

## Why N2 fails, and it is not the exploratory arm's doing

`conj`'s non-neutral value `False` is maximally disruptive — it flips the aggregate and fires the
warning — yet it **escapes observer detection entirely**. A legitimate check can also return
`False`, so the warning is indistinguishable from a true warning. **That arm was frozen.** The
falsification of N2 does not depend on anything added later.

## The substantive finding: neutrality is neither necessary nor reliably sufficient

    escaped observer detection, neutral      4 arms
    escaped observer detection, NON-neutral  4 arms   <- neutrality is NOT necessary
    detected, neutral                        0 arms

Four non-neutral coercions travelled just as far as the neutral ones. What separated the three
detected arms from the eight undetected ones was whether the coerced value's downstream effect left
the range of outputs a failure-free run could produce — `__ERROR__`, `999999` and `ERR` are foreign
tokens, and `False`, `5`, `'a'`, `[]`, `0`, `''` are not.

> **Caution against promoting that into a rival hypothesis.** Under the OBSERVER measure,
> "detected iff outside the producible range" is the *definition* of the measurement, so it is
> analytic and explains nothing. The empirical content is only the negative one:
> **algebraic neutrality does not predict range membership.**

## What survives of H-NEUTRAL

N3 holds under the observer reading. The **identical value `[]`** gave distance INF through
`out.extend(v)` and distance 1 through `v[0]`, where it raised `IndexError`. So danger is genuinely
a property of the **(value, consumer) relation** and not of the value. That part of the intuition is
supported. The proposed *mechanism* for it — algebraic neutrality — is not.

## The extreme case, recorded rather than repaired

`conj`'s neutral element is `True`, which **is** the value a passing check returns. Coercing failure
to the neutral element of a conjunction is therefore indistinguishable from success **even to an
oracle** — the only arm in the experiment with oracle distance INF. The harness flags it
(`coercion_equals_success`). It is not a construction defect; it is the limiting case of what the
hypothesis was about.

## Apparatus

Two construction faults were found by reading the numbers, not by an assertion, and both are now
asserted. Non-failing slots were filled with the last legitimate value, which for `conj` is `False`
and made its aggregate constant regardless of the coercion. A `responsive()` assertion now fails any
pipeline that ignores its failing slot — such a pipeline would report INF everywhere and look like a
clean H-NEUTRAL confirmation while testing nothing.

**Post-freeze addition, labelled:** the `exploratory-in-domain` arms were added during
construction and were not in the preregistration. They are reported separately and they weakened the
hypothesis rather than supporting it. They are not load-bearing for any verdict above.

**Third instance** of my frozen rival list being incomplete: the prereg named H-TOTAL and H-INFO but
not the possibility that a non-neutral value could stay inside the legitimate output range.

## Not claimed

Nothing about real software. Four author-built pipelines and one consumer swap, Stage A, so a pass
would have been weak and a failure is only slightly stronger. H-CONTINUE was not tested and is not
adopted. Nothing installed. The `CLOSED`/`OPEN` proof-frontier vocabulary from REACH-1 is untouched
by this result, and the conjectured link between forced closure and neutral coercion recorded in
`CLOSURE-STATUS.md` **remains unearned** — this experiment does not supply it.
