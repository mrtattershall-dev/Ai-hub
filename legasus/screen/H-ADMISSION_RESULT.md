# H-ADMISSION result — the remedy is viable; the hypothesis gains nothing
2026-09-21. Preregistration `H-ADMISSION_PREREG.md` (5276474), thresholds frozen before measurement.
Targets read-only: `pytorch/pytorch @ 9b6e45278f06` and `odysseus`. Raw: `legasus/out/hadmission/`.

## Corpus corrections made before scoring, both found by inspecting the instrument

1. **Odysseus contained a byte-identical copy of its own tree** — 1004 files duplicated under a
   nested directory. Every function appeared twice, every name was therefore "ambiguous", and
   fan-out was roughly doubled. Fixed by content-hash deduplication in the index, which is
   target-agnostic rather than an Odysseus-specific patch. 1009 duplicate files skipped.
2. **73% of the Odysseus tree was the virtual environment.** The first run measured third-party
   library code. Vendored directories are now excluded; the corpus fell from 7474 files to 999.

PyTorch also carried 181 duplicate files.

## Results — unambiguous-name subset, which is the usable measurement

Name-matched call sites over-count when a name is shared, so shared names are reported separately;
the all-names rows are dominated by collisions (139 of 400 PyTorch controls hit the traversal cap
purely because of names like `get`).

    target     group      n     median   p90   frac > 20 sites   reach at p90
    odysseus   coercing   168   3        13    6.0%              0.127% of program
    odysseus   control    451   0        4     0.9%              0.032%
    pytorch    coercing   219   1        10    4.1%              0.004%
    pytorch    control    183   0        5     3.3%              0.002%

## Scoring

    A1  CONCENTRATION   HOLDS on both targets   median 3 and 1 (threshold <= 5);
                        6.0% and 4.1% over 20 sites (threshold <= 10%)
    A3  RELOCATION      HOLDS on both targets   0.127% and 0.004% of functions reached at p90
                        (threshold < 5%)
    A2  SPECIFICITY     FAILS on both targets, decisively and in the direction against
                        H-ADMISSION

Mann-Whitney, coercing versus control discharge fan-out:

    odysseus   z = +14.18   p = 1.3e-45
    pytorch    z =  +8.32   p = 8.6e-17

**Failure-coercing functions are significantly MORE consumed than typical functions**, on two
independent targets. The frozen falsifier for A2 was *"coercing functions are materially more
diffuse than controls"*. They are.

> **A1 therefore scores nothing as evidence for H-ADMISSION.** This was written into the
> preregistration precisely so a concentration result could not be claimed without specificity —
> the step-16 trap. It sprang.

## What this does and does not establish

**Establishes, as an engineering fact:** if every real failure-coercion site produced a tagged
value, the obligation would have to be discharged at a median of 1 to 3 sites, at 10 to 13 sites at
the 90th percentile, touching well under 1% of the program. **The proposed architecture is not
self-defeating.** Tagging concentrates rather than relocates, and it does so on two independently
developed targets. That is the question that mattered practically, and the answer is positive.

**Does not establish anything about H-ADMISSION itself.** Coercion sites are not specially isolated.
They sit on *more* heavily used functions than average, which is unsurprising — a utility with error
handling is a utility that gets called — but it removes the only prospective support this experiment
could have supplied.

> **H-ADMISSION stands exactly where H-SUBST stands:** retrospectively attractive, no prospective
> evidence, not adopted, nothing installed. What it has gained is a remedy shown to be viable, not
> a reason to believe the diagnosis.

The four-apparatus-failure topology remains excluded as retrospective, as the preregistration
required.

## Bias directions, stated because they all run one way

Three instrument choices bias **against** the hypothesis and none for it:

    traversal cap        hitting it is recorded as diffuse, so the cap cannot manufacture
                         concentration
    name matching        over-counts consumers, inflating fan-out
    forwarding rule      only `return f(...)` and assign-then-return count as propagation, so
                         forwarding is under-counted and discharge over-counted

A1 and A3 therefore hold despite the instrument leaning the other way. A2's failure is not
attributable to these, since both groups are measured identically.

## Not claimed

Two targets, one language, one coercion shape (`except ...: return <ordinary constant>`). No claim
that admission is the common root of anything. No detector changed, no architecture installed, and
the `LOCAL`/`PROGRAM` split from REACH-1 remains unbuilt.

---

## CORRECTION 2026-09-21 (from H-INVERSE, 3840745)

The PyTorch target is a **sparse checkout, pattern `*.py`** — zero C++, CUDA, `.pyi` or Cython
sources. **The "Bias directions" section above is wrong**: non-Python callers are invisible there,
so consumers are undercounted and concentration is *overstated*, a bias toward A1 rather than away.

A1 survives on the other target. Odysseus is a full checkout with median 3, inside the frozen
threshold of 5. **Read A1 off Odysseus, not PyTorch.** A2's failure is unaffected, since both groups
are measured in the same corpus.
