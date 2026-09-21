# Identity census — the equivalence relation was already built, and it is called `resolve`
2026-09-21. A complete census, not an experiment. Every sameness operation in the branch's
harnesses, enumerated before failures were mapped onto it.

## It exists, it was deliberate, and it was never promoted

`screen2.py:21`, frozen at SHA-256 `52b6a7a0…`:

```python
def resolve(node):
    """The contract's SUPPORTED EQUIVALENCE RELATION, deliberately narrow.

    Literal constants by value, plus the handful of trivially foldable forms. Everything else
    is UNRESOLVED and must push the verdict to UNKNOWN - it may never be guessed at.
    """
```

`UNRESOLVED = object()` — *"distinct from every real value, including None"*. This is the only
place in the branch where the primitive was named, given a **refusal state**, and deliberately
kept narrow. It was never turned into a shared object, so every other harness re-invented its own
equivalence ad hoc, and none of those inherited the refusal.

## The census

`R` is the projection actually computed. The question each row answers is: **what does `R(a)=R(b)`
get taken to mean?**

    #   site                             R = projection            refusal?  recorded false identity
    1   screen2 resolve                  narrow literal fold       YES       none
    2   screen2 INV-A2 compare           (type, value)             YES       none
    3   w_experiment discrimination      result string             YES       none (UNOBSERVABLE excluded)
    4   BIND identity triple             requested/served/executed YES       none - it CAUGHT one
    5   DETECTOR-FREEZE                  SHA-256 of bytes          n/a       none
    6   reach1 literal_produces          truthiness                PARTIAL   none yet
    7   reach1 TRUSTED_TAILS {"get"}     attribute NAME            NO        not yet
    8   reach1 / hadmission call sites   callee name               NO        YES - inflated fan-out
    9   reach1 resolve_call_arg          positional index          NO*       YES - 16/60 verdicts
    10  hadmission is_in_domain_const    (type, value)             NO        not yet
    11  hadmission tree membership       path parts                NO        YES - venv counted as program
    12  hadmission file identity         file PATH                 NO        YES - duplicated tree
    13  hneutral output comparison       repr string               NO        not yet
    14  hinfo observation equality       the representation        NO        YES - the richness run
    15  dcomp1 X1 grading                per-clause PASS/FAIL      NO        YES - one clause for F1

`*` #9 now carries `star_args` and `omitted_no_default`, added after it failed.

## The split

    sites WITH a refusal state      5 (+1 partial)   recorded false identities: 0
    sites WITHOUT a refusal state   9                recorded false identities: 6

Suggestive, and **retrospective** — the failures were known before the census was written, which is
exactly the objection that keeps H-SUBST unadopted. The census earns its keep only by the
prediction below.

## Both of the mirror failure modes are attested, and one of each came from today

The two directions are symmetric and both are real in my own instruments:

    illegitimate state normalized onto the canonical one -> falsely ADMITTED
        venv files counted as part of the program (#11); keyword arguments collapsed onto the
        positional-index case (#9)

    legitimately identical states treated as distinct -> falsely REJECTED
        two byte-identical copies of the Odysseus tree counted as two separate programs (#12),
        doubling every function and making every name look ambiguous

The second direction had never appeared in this branch's record before today. **It is not a
degenerate case of information loss.** Nothing was erased; a difference was *invented*. H-INFO has
no account of it, because H-INFO only penalises collapsing distinctions.

## The prospective prediction, frozen now

The census was completed before this was written, and the rows are fixed.

> **The next false identity in this branch will occur at one of the no-refusal sites that has not
> yet failed: #7 (attribute name standing for function identity), #10 (in-domain constant class),
> or #13 (repr standing for value).**

FALSIFIER: the next recorded false identity occurs at a site carrying a refusal state, or at a
sameness operation absent from this census.

## The prediction paid out immediately, at site #7, inside a committed result

`TRUSTED_TAILS = {"get"}` matches **any** attribute named `get`. Enumerating all three
`trusted_primitive` facts in the scored REACH-1 run found one that is not a dictionary:

    path_helper.py::get_path::path   REACHABLE   self._hash_cache_var.get()

`_hash_cache_var` is a `ContextVar`, declared `ContextVar[bytes | None]` at
`torch/utils/_config_module.py:302`. The harness's rule is *"`.get()` with no second positional
argument yields `None`"*, which is true of `dict.get` and **false** of `ContextVar.get`, whose
default is fixed at construction and which raises `LookupError` when there is none.

That construction happens to pass `default=None`, so **the verdict is correct and its justification
is unsound.** The equivalence `attribute named get ≡ dict.get` did the work. Had the default been
any truthy value the verdict would have been wrong, and nothing in the harness would have noticed.

This is the branch's own subject matter occurring inside its own instrument: a correct conclusion
resting on an entitlement it does not have. It was found by the census, at the site the census
named, without running anything. `requests.get` also occurs in the target subtree the primary
sample was drawn from, and would have been classified as trusted ground.

**Effect on the committed REACH-1 result:** the other two trusted facts are genuine `dict.get`
calls, so no scored verdict changes. The record stands; the justification for one of its 29 settled
verdicts does not.

## What this does not claim

Not that identity is the atom, and not that the layering `entitlement / proposition / distinction /
identity / equivalence / canonical reference` is correct. Those are a hypothesis about structure
with no prospective test yet. The census establishes only two things: the primitive was already
built under another name, and refusal states correlate with the absence of recorded false
identities across fifteen enumerated sites.

Nothing installed. No harness changed by this document, including #7, which is recorded as a defect
rather than repaired mid-census.
