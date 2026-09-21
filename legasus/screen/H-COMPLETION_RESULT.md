# H-COMPLETION result — K-1 holds on 3 testable rows, K-2 holds, one row untested
2026-09-21. Preregistration `H-COMPLETION_PREREG.md` (a84d085), frozen before any witness was
sought. Raw: `legasus/out/hadmission/completion_audit*.json`.

## Scoring

    id   completion policy   PREDICTED   observed   evidence
    C1   MAP TO EXISTING     MERGE       MERGE      527 module-level calls, all counted as discharge
    C2   DROP                SPLIT       UNTESTED   0 unparseable files across all three targets
    C3   REFUSE              NEITHER     NEITHER    27 real `*args`/`**kwargs` cases, 0 settled
    C4   REFUSE              NEITHER     NEITHER    0 settled outside the supported predicate
    C5   DROP                SPLIT       SPLIT      1462/2008 odysseus, 1674/4942 pytorch dropped

    K-1  HOLDS on the 3 testable rows
    K-2  HOLDS - neither REFUSE row produced a merge or a split witness
    K-3  HOLDS - C1 merges, C5 splits

## C2 is untested, not confirmed

The relation is **never undefined** on any target: zero files failed to parse in Odysseus, PyTorch
or MoneyPrinterTurbo. An unexercised row is not a confirmation, and it is not scored as one.

## C1 is the row that carries the result

The relation `enclosing(call)` is undefined for a call at module level, because there is no
enclosing function. The superficial reading of "missing" is SPLIT. The **policy** is MAP, because
`forwards(call, None)` returns `None` and the caller counts that as a discharge site. MERGE was
predicted against the sign, and 527 of 527 undefined cases in Odysseus were mapped into the existing
`discharge` class.

> **This is the second genuinely risky prediction this line has made, and it has the same shape as
> the first.** M2 and C1 are both `MAP TO EXISTING -> MERGE` predicted against the superficial sign
> of a missing case, and both held. That convergence is the only thing here worth taking seriously.

## Honest discounting, as with H-INVERSE

    C5   near-analytic. "Drop test directories" and "test functions are absent" are close to the
         same statement.
    C4   near-analytic. It probes the return contract of a function I wrote, with three probes.
    C3   a real control. 27 genuine star-argument cases in external code, every one left UNKNOWN
         with a recorded blocking kind rather than settled.
    C1   informative.
    C2   untested.

Real content: **one strong result, one real control, two near-tautologies, one unexercised row.**

## A scope fact about an earlier result, found in passing

`screen2`'s `SKIP_DIRS` excludes test directories, and the magnitude is large:

    odysseus   1462 of 2008 files dropped   (73%)
    pytorch    1674 of 4942 files dropped   (34%)
    mpt          71 of  121 files dropped   (59%)

The exclusion is deliberate and correct — tests are not the program under analysis. But
**SCREEN-1's "zero findings on Odysseus" was computed over roughly a quarter of that repository's
Python files**, and that scope belongs next to the claim. This is the same shrinkage as the
sparse-PyTorch correction: the local result stays valid while its scope shrinks.

## Standing

The candidate hierarchy now reads:

    wrong verdicts
      <- false merge / false split
        <- unlicensed inversion
          <- mapping property fails over the RELEVANT TARGET DOMAIN
            <- a partial relation was forced total instead of remaining undefined

The bottom step has two non-trivial prospective confirmations (M2, C1) and one working control
(C3). Everything above it remains as recorded. Refusal now looks like the *implementation* that
preserves partiality rather than the primitive itself, which is a demotion of H-REFUSAL and not a
refutation of it.

Still one lineage, one author, two-and-a-bit targets. **Not established: that `partial -> total` is
the root of anything.** Nothing installed; sites #7 and #10 remain unrepaired.
