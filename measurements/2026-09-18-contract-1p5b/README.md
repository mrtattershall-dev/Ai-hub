# PREREGISTRATION — does representing the three contracts change what the 1.5B can do?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## The question

Every earlier measurement of Qwen2.5-Coder-1.5B predates the structural, transaction and semantic
contracts. The model is byte-identical to the one that scored badly. **The apparatus is the variable.**

> Does handing the model WHERE it may act, WHAT must exist first, and WHAT the code must mean —
> without telling it how to write the answer — change what it produces?

## The discriminating case, and why it is sharp

The must-distinguish pair shares one program, one new predicate, one overlap and one witness input.

    CASE A   the existing zero behaviour keeps the contested input
    CASE B   the new small behaviour takes it

**Case B is the case that ordinary completion gets wrong.** Appending a new guard after the existing
`n == 0` check is the natural continuation, and it produces case A's semantics. A model that is only
told "values below 10 should now return small, including values that previously returned zero" must
notice that source order defeats the request. A model given the contract is told the ruling outright.

So case B is where an apparatus effect, if any, must appear.

## Arms

    BASELINE   the original source + the task goal in prose, as the earlier runs were framed
    CONTRACT   the original source + the assembled obligations package from GATE 12E

Both arms receive the identical source and identical model, temperature and token budget. The only
difference is which framing of the request is supplied. **The leakage scanner runs over every CONTRACT
prompt before the window opens**; any prompt naming a site, ordering or branch shape voids that prompt
rather than being explained afterwards.

## Endpoints, fixed now

    PRIMARY     conformance, per arm per case, by EXECUTION:
                  on the overlap witness the winner's result is produced
                  on an uncontested input of each domain the respective result is produced
                  every preserved behaviour still holds
    SECONDARY   syntactic validity rate (does the output parse and import at all)
    SECONDARY   implementation diversity among conforming outputs - distinct normalised shapes.
                A contract that admits only one shape would have encoded the patch.
    GUARD       leakage scan over every prompt; any hit voids that prompt

Conformance is scored by running the produced code, never by comparing it to a reference. Two
structurally different correct answers must both count, exactly as the GATE 12D anti-oracle test
requires.

## Sample size and what it can support

10 samples per arm per case, 2 cases, 2 arms = **40 generations**.

**This is a mechanism check, not a rate estimate.** Ten samples gives a rule-of-three upper bound near
26% on a clean 0/10, which is enough to see a large apparatus effect and nowhere near enough to
publish a rate. If the arms differ by one or two samples, that will be reported as inconclusive.

## Declared in advance: what would make this null

- Both arms conform on case B at similar rates → the contracts did not help here
- The CONTRACT arm conforms on case A but not case B → it is following source order, not the ruling
- Any leakage hit → that prompt is void and the comparison is not made on it

## Cost and safety

T4, weights pulled in-container, `scaledown_window` 5 minutes, `min_containers` 0. Hard wall-clock cap
30 minutes. Stop with `modal app stop --yes` and verify with `modal app list` — the stop command
prompts and aborts non-interactively without `--yes`, which cost five over-cap minutes on 2026-09-10.
AC power confirmed before the window (BatteryStatus 2, 98%).

**Rule 3:** `/api/health` must name the exact model before any generation runs.
