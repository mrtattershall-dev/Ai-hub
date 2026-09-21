# H-DEFINED result — D-1 FAILS as predicted. Definedness does not bottom out; it recurses.
2026-09-21. Preregistration `H-DEFINED_PREREG.md`, frozen before any site was classified.
Target `pytorch @ 9b6e45278f06`, 4759 files. Raw: `legasus/out/hadmission/defined_audit.json`.

## The decisive witnesses

`reach1`'s rule is `attr_tail(f) in TRUSTED_TAILS`. Its **entire input** is the attribute spelling
and the argument count. Three pairs share that input exactly while differing in domain membership:

    site sees {attr_tail: 'get', n_args: 1}
        dict-like    setup.py:53                     FORWARDS.get(command)
        ContextVar   test\dynamo\test_contextvars.py:35   cv.get('fallback')

    site sees {attr_tail: 'get', n_args: 2}
        dict-like    scripts\lintrunner.py:111       env.get('PATH', '')
        ContextVar   test\dynamo\test_contextvars.py:60   cv.get(1, 2)

    site sees {attr_tail: 'get', n_args: 0}
        dict-like    test\test_monitor.py:61         s.get()
        ContextVar   test\test_autograd.py:8363      active_context.get()

The third pair is the census specimen made structural. The rule's premise is *"`.get()` with no
second positional argument yields `None`"*, which is true for the dictionary and false for the
`ContextVar`, which raises `LookupError` when unset. **`defined` is provably not a function of this
site's input.** The bit was never there to be discarded.

## Scoring

    D-1  FAILS, as predicted and named in advance  -  S3 carries indistinguishable pairs
    D-2  HOLDS  -  the sites split, 6 available against 1 unavailable
    D-3  HOLDS  -  6 sites can carry the bit, so the discipline is not vacuous

    site                        definedness              status
    S1  forwards()              function of the Return node        bit DISCARDED
    S2  is_in_domain_const      function of the expression node    bit DISCARDED
    S3  TRUSTED_TAILS           NOT a function of its input        bit UNAVAILABLE
    S4  enclosing()             returned as None to the caller     bit DISCARDED
    S5  SKIP_DIRS               function of the file path          bit DISCARDED
    S6  resolve_call_arg star   records a blocking kind            bit PRESERVED
    S7  resolve                 returns UNRESOLVED                 bit PRESERVED

## What this does to *definedness precedes value*

The strong reading — that the bit is always available and merely thrown away — is **false**. At six
of seven sites it was available and six times out of seven it was either discarded or preserved. At
S3 it was not available at all.

> **So `defined` is not a foundation. It is a recursive obligation.** Deciding whether `x.get` is
> `dict.get` requires the receiver's type, which is itself a proposition needing evidence, whose
> settlement is exactly the CLOSED/OPEN proof frontier from REACH-1: a claim is settled only when
> its dependency closure terminates in admitted grounds.

This is the outcome the preregistration named as the more interesting one, and it is the first
result in this branch that **connects the bottom of the stack back to its middle**. The descent does
not terminate at definedness. It turns into the reachability machinery already built.

## Revised reading of the stack

    ENTITLEMENT / PROPOSITION / IDENTITY / REPRESENTATION / VALUE
        |
        v
    DEFINEDNESS          - sometimes a free local bit (6 of 7 sites)
        |
        v
    DOMAIN MEMBERSHIP    - sometimes a CLAIM requiring its own evidence closure (S3)
        |
        v
    (back to the proof frontier: CLOSED if the closure terminates in admitted grounds, else OPEN)

## Standing and limits

Two non-trivial prospective confirmations for H-COMPLETION (M2, C1), and one prospective prediction
for H-DEFINED that was named in advance and failed in the predicted direction, which is evidence
about the *shape* of the claim rather than for the claim.

One lineage, one author, and the sites are not independent — six of seven are code I wrote. The
claim that `DEFINED = 1` is the universal hidden constant is **not** established and is not adopted.
What is established is narrower and, I think, more useful:

> **The definedness bit is available at most of these sites and unavailable at one, and where it is
> unavailable, establishing it is a proof obligation of the same kind the branch already knows how
> to score.**

Nothing installed. Sites #7 and #10 remain unrepaired; S3 is site #7, and this result is the reason
it must stay that way.
