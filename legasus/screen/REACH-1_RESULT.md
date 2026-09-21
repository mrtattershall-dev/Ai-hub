# REACH-1 result — reachability is never local, and the proof metric I was given is the wrong one
2026-09-21. Preregistration `REACH-1_PREREG.md` (3c5b249), frozen before the harness existed.
Target `pytorch/pytorch @ 9b6e45278f06`, read-only, 4942 files, 0 unparsed.
Raw: `legasus/out/reach1/`.

## Calibration — the harness reproduces all three known verdicts, but only one by analysis

    calib-3 validate_cuda        UNREACHABLE   radius 2, 2 files, 4 facts, trusted terminal
    calib-1 gh_summary_path      UNKNOWN       environment
    calib-2 local_image_exists   UNKNOWN       environment

Case 3's closure is exactly four facts and terminates in the frozen `or` primitive:

    r0  decision_site  vllm_test.py:291    def validate_cuda
    r1  call_site      vllm_test.py:221    if not validate_cuda(get_env("TORCH_CUDA_ARCH_LIST")):
    r2  callee_def     envs_helper.py:15   def get_env
    r2  or_fallback    envs_helper.py:17   os.environ.get(name) or default

The harness **derived** the exclusion that I originally missed and only found by accident while
looking at something else.

> **Honesty item.** Cases 1 and 2 returned `UNKNOWN` **by declaration**, not by analysis: I
> classified their decisive states as environment/exception in the case file and the harness
> short-circuits on that classification. The tracer was exercised by exactly **one** calibration
> case. The prospective sets are therefore restricted to value-domain states, where no such
> short-circuit exists.

## Prospective sets

Selected by a frozen mechanical rule — a positional parameter guarded by `if not p:` or `if p:` at
the top level of its function. 1386 candidates. Two sets of 60: the frozen path-order set
(**primary**, and concentrated in CI/tooling by construction), and an evenly-spaced set (**spread**,
54/60 torch core) declared as a robustness check before it was run.

    PRIMARY   REACHABLE 27   UNREACHABLE 2   UNKNOWN 31
    SPREAD    REACHABLE 30   UNREACHABLE 3   UNKNOWN 27

`REACHABLE` here means *the guarded falsy state can be produced*. It is **not** a defect — the
guard exists to handle it. This is a reachability certificate, which is exactly the point.

## R2 — CONFIRMED, and this is the operational payload

    closure extends beyond the function body     PRIMARY 59/60     SPREAD 50/60
    settled inside the decision file alone       PRIMARY  3/60     SPREAD  5/60

**Reachability of a decisive state is essentially never settleable where the decision is made.**
R3 (the line-killer: everything settles locally) is dead.

## R1 — the dissociation holds; radius does not predict the verdict

The frozen falsifier was *verdicts are monotone in radius*. They are not:

    a single radius carries multiple verdicts    radii 1, 2 (primary); radii 1, 2, 9 (spread)
    REACHABLE spans                              radius 1..4 (primary), 1..9 (spread)
    UNKNOWN spans                                radius 0..2 (primary), 0..9 (spread)

Distance and provability are independent. Radius is not an adequate proxy.

### But R1(a) as I worded it is FALSE, and the wording was defective

R1(a) predicted large-radius cases settled through a **short** closure. Every radius >= 3 case was
settled (5/5 primary, 4/5 spread) — but through the **largest** closures in the sample:

    radius >= 3 settled, definitions required    10, 14, 16, 24, 35   (primary)

Two failures, and both are mine:

1. **"Short" was never quantified in the preregistration.** It is not scorable as written. I am not
   supplying a threshold now.
2. **On any reading the direction is backwards.** Long-radius settled cases had big closures.

## The unpredicted finding, which corrects the proposed metric

> **Minimal proof-slice SIZE is not a measure of proof difficulty. It runs the other way.**

    definitions required, median      settled 8.0 | UNKNOWN 0.0   (primary)
                                      settled 7.0 | UNKNOWN 0.0   (spread)

An `UNKNOWN` closure is *small* because it terminates immediately on hitting a blocking source. A
settled closure is large because it kept going until it reached ground. Ranking cases by slice size
would rank the unprovable ones as easiest.

What separates them perfectly is **where the closure terminates**:

    closure reaches a trusted primitive  ->  SETTLED        8/8 across both samples
    UNKNOWN with a trusted terminal      ->  never          0/58

Trusted termination is **sufficient and never necessary** — 52 settled cases reached ground by
literals and defaults without touching the trusted list. Blocking kinds, in order:
`dynamic_dispatch` 57, `omitted_no_default` 17, `no_call_site` 14, `star_args` 9, `external_call` 3,
`depth_cap` 2.

So the recordable quantity is not radius and not slice size. It is the **termination profile** of
the closure: does every branch reach ground, and by what kind of fact.

## Apparatus failures, recorded

**One recording fix moved 16 of 60 verdicts.** The first harness appended `UNKNOWN` on two
call-site paths without recording a blocking kind — 23 naked `UNKNOWN`s, violating the
preregistration. Diagnosing it exposed a worse gap: **keyword arguments were ignored entirely**, so
every keyword-supplied value was invisible and silently became `UNKNOWN`. Both were recording
faults, not criterion changes; the case set was untouched and calibration was re-run and unchanged.
The pre-fix run is retained at `out/reach1/prospective.json`.

An assertion now fails the run if any `UNKNOWN` lacks a blocking kind. This is the seventh time the
remedy has been *assert the precondition*.

**Soundness.** This is not a sound reachability analysis and does not claim to be: 6 call sites per
parameter, 3 targets per callee, depth cap 8, no interprocedural aliasing, no class hierarchy.
Every limit produces `UNKNOWN`, which is a result and never collapses to a settled value.

## What is entitled to be claimed

1. On this target, under this rule, reachability evidence lies outside the decision site in
   50–59 of 60 cases. **A purely local detector cannot license program-level claims from local
   evidence alone.**
2. **Structural distance does not predict provability**, in either direction.
3. **Slice size does not measure proof difficulty**; it inversely tracks it. Termination profile
   does.
4. `REACHABLE` / `UNREACHABLE` / `UNKNOWN` is the honest output shape, and `UNKNOWN` was the
   plurality verdict in both samples.

## Not claimed

Not that this generalizes past one target and one guard shape. Not that the `REACHABLE` verdicts
indicate defects — they indicate reachable guarded states. Not H-SUBST, which still has no
prospective prediction. Nothing is installed: the two-output `LOCAL` / `PROGRAM` architecture stated
in the preregistration is **licensed by R2 but not built**, and no existing detector has been
changed.
