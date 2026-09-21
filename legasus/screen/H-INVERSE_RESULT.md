# H-INVERSE result — V-1 holds 6/6, and most of those 6 carry almost no information
2026-09-21. Preregistration `H-INVERSE_PREREG.md` (3840745), frozen before any mapping was tested.
Two targets. Raw: `legasus/out/hadmission/inverse_audit_{ody,pt}.json`.

## Scoring

    id   required property   PREDICTED      odysseus   pytorch   observed direction   match
    M1   injectivity         FALSE MERGE    fails      fails     merge                yes
    M2   coverage            FALSE MERGE *  fails      fails     merge                yes
    M3   coverage            FALSE SPLIT    fails      holds     split                yes
    M4   injectivity         FALSE MERGE    fails      fails     merge                yes
    M5   coverage            FALSE SPLIT    fails      holds     split                yes
    M6   canonicality        FALSE SPLIT    holds      fails     split                yes

    V-1  HOLDS   every observed failure runs in the predicted direction, 6/6
    V-2  HOLDS   both directions occur: M1/M2/M4 merge, M3/M5/M6 split
    V-3  HOLDS   per target - M3 and M5 hold on pytorch, M6 holds on odysseus

## Why 6/6 is worth much less than it looks

**M1 and M4 are close to analytic.** "Injectivity fails" and "two things were merged" are nearly the
same statement. Predicting a merge from an injectivity failure risks no information at all.

    M1  one name `__init__` denotes 9055 distinct definitions in pytorch, 288 in odysseus
    M4  nine distinct decisive states - None, '', 0, 0.0, False, [], (), {}, set() - all yield
        the one REACHABLE branch

**M3, M5 and M6 are mildly informative.** Coverage and canonicality failures usually split, so the
prediction follows the conventional sign.

    M3  odysseus carries 422 .pyi, 24 .pxd and 11 .pyx files the index cannot see
    M5  `except: ... vecs = [] ... return vecs` at src\embeddings.py:106 is a real coercion the
        rule misses, because it is bound to a name rather than returned as a literal
    M6  pytorch has AST-identical modules with 16 distinct byte hashes - the same logical unit in
        many representations

**M2 is the only genuinely risky row, and it was frozen as such.** A coverage failure predicted to
**merge**, against the usual sign, because unrecognised forwarding is not dropped but reclassified
as discharge. It merged on both targets:

    return await serve_index(request)                     odysseus app.py:876
    return subprocess.run(replacement).returncode         pytorch setup.py:60

The value is forwarded; the rule says it is consumed; forward and discharge collapse into one
outcome.

> **So V-1's real content is one strong confirmation, three mild ones and two near-tautologies.**
> Reporting it as 6/6 would overstate it by a lot.

## A second finding that cuts against the framing

**No mapping's property holds on both targets.** M3, M5 and M6 each hold on one target and fail on
the other. They are therefore properties of the **map-and-target pair**, not of the map. Only M1,
M2 and M4 are intrinsic to the machinery.

That weakens the picture of injectivity, coverage and canonicality as mathematical properties of a
representation that can be classified once and relied on. Three of six are contingent on the corpus.

## Correction to an earlier claim in H-ADMISSION

The PyTorch target is a **sparse checkout with pattern `*.py`** — `core.sparseCheckout = true`,
4942 files, **zero** C++, CUDA, `.pyi` or Cython sources. It is a Python-only subset of the
repository, not the repository.

`H-ADMISSION_RESULT.md` states that all three instrument biases run against the hypothesis. **That
claim is wrong and is corrected here.** Non-Python callers are invisible in that target, so
consumers are undercounted and concentration is **overstated** — a bias toward A1, which held.

The conclusion survives, but on the other target's numbers. Odysseus is a full checkout, its
coercing median was **3** against PyTorch's 1, and 3 is still inside the frozen threshold of 5.
**A1 should be read off Odysseus, not PyTorch.** REACH-1 is less affected: missing producers push
traces toward `UNKNOWN`, which is that experiment's safe direction.

## Standing

H-INVERSE has one non-trivial prospective confirmation (M2) on a frozen set, plus consistency with
census sites #7, #10 and #13. That is more than H-NEUTRAL, H-ADMISSION or H-SUBST ever obtained, and
it is far short of establishing that representation inversion is the root of anything.

The claim that `S <-> R` bijection-assumption underlies the branch's failures remains an account
with no standing outside this lineage. Nothing installed. Sites #7 and #10 remain unrepaired.
