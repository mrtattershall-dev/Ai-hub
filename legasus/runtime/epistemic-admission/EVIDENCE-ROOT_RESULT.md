# Evidence roots — E1..E6 hold. A witness is now a reference to established authority.
2026-09-21. Preregistration `EVIDENCE-ROOT_PREREG.md`, frozen before implementation.
64 tests across six suites, all passing. **Registry still three rules. Rule selection still
unattacked. Census unmoved. `legaknow` byte-unchanged.**

## The third version of one problem, now closed

    v1.2   "COVERAGE"                        the NAME was enough
    v1.3   "COVERAGE about P/R rooted at E"  the BINDINGS are required
    v1.4   E establishes COVERAGE(P, R)      the EVIDENCE must carry the relation

> **A relation witness is not evidence. It is a reference to an independently established relation
> claim.**

## Scoring

    E1  valid authority for the exact relation instance      SATISFIES
    E2  real id, authority INVALIDATED                       REFUSES - "Stale authority establishes
                                                             nothing"
    E3  valid authority, unrelated proposition               REFUSES - "A valid token for another
                                                             proposition is not evidence for this one"
    E4  right proposition, wrong world                       REFUSES - "A relation proven in another
                                                             world does not hold in this one"
    E5  root depends on the claim it justifies               REFUSES - "CIRCULAR JUSTIFICATION IS NOT
                                                             JUSTIFICATION"
    E6  relation established by DERIVE, not OBSERVE          SATISFIES

    C-2  REGRESSION  an unresolvable root now refuses where v1.3 accepted it; with no store at all
                     the adapter refuses rather than defaulting open
    C-3  the matcher resolves a REFERENCE and compares claim strings it constructed. It reads no
         payload; asserted on the source.
    C-4  legaknow byte-unchanged, asserted by git
    C-5  census unmoved: still {UNKNOWN_RULE: 9, UNDECLARED: 6}

## How, and how deliberately not

The matcher does **not** inspect an evidence payload and judge whether it looks convincing — that
would make the registry a second epistemic oracle. It resolves the root in an authority store to a
token the **calculus** minted, and compares the token's own claim against a canonical string the
consumer constructs: `COVERAGE(subject, object)`. The store itself refuses to file anything
unbranded, so it cannot become a place where objects acquire standing by being stored.

**E6 is why this is not a refusal machine.** A relation composed by `derive()` from two partial
coverage tokens still satisfies. Accepting only primitive observations would have passed E2 through
E5 perfectly while making composed relational knowledge impossible.

## The drift mechanism worked on its own designers

Changing the matchers moved two of the three rule definitions, so the producer's pinned fingerprints
became stale and its certificates were refused with `RULE_DEFINITION_MOVED` until it re-pinned. The
third rule, `claim-from-direct-observation`, has no obligation and therefore no matcher, and its
digest did not move. That is the drift rule catching a real semantic change rather than a cosmetic
one.

## Apparatus — the fifth instance, and the most instructive

    V-5        a certificate passed where a measurement object was expected
    adapter    matched `delegate` inside the comment saying delegate is not called
    v1.2       a stale literal version string
    B-4        matched `legaknow` inside the comment saying legaknow is untouched
    HERE       the comment stripper itself was broken

The helper `s.split('\n').map(l => l.replace(/\/\/.*$/, ''))` **does not strip comments on a CRLF
file**. JS `.` does not match `\r`, so `.*$` cannot reach end-of-string and the match fails: the
`//` stays and so does the text. Every independence assertion using it was reading comment prose as
code. It produced false FAILURES rather than false passes here, but the same bug in a
`doesNotMatch` would have produced silent false confidence.

Fixed by stripping `\r` first, in every suite that uses the helper.

## Limits

Two matchers, for two relations, written by me. The store is populated by test support standing in
for prior admissions; in a real system those tokens would come from earlier admitted certificates,
and that path does not exist yet. **Rule selection remains unattacked**, and the fifteen
pre-registry declarations are now spent as held-out material — I have inspected all of them, so they
can answer only *"does a new selector suddenly claim to understand what it previously could not?"*
Prospective evidence for selection needs derivations that did not exist when the semantics were
written.
