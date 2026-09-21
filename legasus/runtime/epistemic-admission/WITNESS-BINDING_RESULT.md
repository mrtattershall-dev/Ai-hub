# Witness binding — W1..W5 hold. The fourth specimen is closed; the census is not.
2026-09-21. Preregistration `WITNESS-BINDING_PREREG.md`, frozen before implementation.
53 tests across five suites, all passing. **Registry still three rules. `legaknow` byte-unchanged.**

## The defect, one level below the previous one

The calculus already held that **coexistence does not establish relation**. The fourth specimen
generalised it:

> **Naming a relation does not establish that the relation holds between THESE endpoints.**

    COVERAGE                                  a label
    COVERAGE(evidence E, domain D, claim C)   a relation instance

## Scoring

    W1  correct relation, domain and endpoints        ACCEPTED
    W2  same name, wrong claim domain                 REFUSED - "covers SAMPLE and the claim is over
                                                      A_DOMAIN_NEVER_COVERED"
    W3  correct domain, evidence_root null            REFUSED - "asserts coverage without rooting in
                                                      anything"
    W4  same name and evidence, different subject     REFUSED - "not a premise of this derivation"
    W5  fully bound witness                           ACCEPTED   <- the refusal-machine guard

    B-2  REGRESSION CLOSED   the v1.2 specimen no longer reproduces
    B-3  DRIFT COVERS        a rule that requires the same relation but SATISFIES it more loosely is
         SEMANTICS           a different rule, and gets a different digest
    B-4  NO CALCULUS EDIT    verified by git inside the test, not by grepping prose
    B-5  CENSUS UNMOVED      still {UNKNOWN_RULE: 9, UNDECLARED: 6}

## Who owns satisfaction

    producer    offers witness CANDIDATES
    rule        owns the matcher that decides whether a candidate binds
    calculus    refuses on a missing witness, on its own terms

An unbound candidate is simply **not forwarded** to `derive()`, so `legaknow` was not modified to
accommodate the consumer. The schema gives a producer no field to assert satisfaction:
`satisfies`, `satisfied`, `binds` and `accepted` are all refused, and a candidate carrying such a
field changes nothing because the matcher never reads it.

**The digest now covers the matcher.** Digesting only `{name, requires, version}` would have let the
satisfaction condition change silently underneath a certificate that still validated — the drift
this project refuses at every other boundary. Every rule's fingerprint moved when satisfaction
stopped being a name comparison, and v1.2-pinned certificates are correctly refused.

## What moved and what deliberately did not

**Moved:** the v1.2 specimen is repaired. `adequacy.test.mjs`'s A-5 now asserts the repair rather
than the defect, with the original finding preserved in place — and its first half still holds, because
`derive()` itself still matches by name. That is a fact about the calculus and is not repaired here.

**Did not move:** the census. The three rules still recognise **zero** inference obligations they did
not author, over the fifteen held-out pre-registry declarations. Witness binding was not used to make
that table look better, and no applicability predicate was written against those fifteen. They remain
hostile.

## Apparatus — the fourth of its kind, and now a pattern worth naming

The B-4 check first failed because it scanned `rules.mjs` for the word `legaknow` and matched the
comment saying `legaknow` is not modified. That is the **fourth** source-scan in this sequence to read
prose as code:

    V-5        a certificate passed where a measurement object was expected
    adapter    matched `delegate` inside the comment saying delegate is not called
    v1.2       a stale literal version string
    B-4        matched `legaknow` inside the comment saying legaknow is untouched

Every one is a measure looking at the wrong thing, which is this branch's standing subject appearing
in its own instruments. B-4 now asks **git** whether a file changed, which is the evidence that
actually settles it.

## Limits

Two matchers, for two relations, written by me. They constrain domain, subject and evidence-root
presence — not whether the evidence root *contains* what it claims. A witness naming a real premise
and a real evidence id still binds without that evidence being inspected. **Rule selection remains
unattacked**, and the registry's zero correspondence stands.
