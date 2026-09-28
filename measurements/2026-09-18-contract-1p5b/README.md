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

---

# RESULT — contract vs baseline on Qwen2.5-Coder-1.5B, Modal T4

Rule 3 verified before any generation: the endpoint named `qwen2.5-coder:1.5b`, Q4_K_M, 32K context.
Leakage scan clean on both contract prompts. 10 samples per arm per case, temperature 0.6, identical
source / model / temperature / token budget across arms. GPU window ~10 minutes, stopped and verified.

    arm        case A        case B        parsed
    BASELINE   3/10          2/10          10/10
    CONTRACT   2/10          1/10          10/10

## The preregistered verdict: NULL

The preregistration named this outcome in advance — *"both arms conform on case B at similar rates →
the contracts did not help here."* 2 against 1 at n=10 is noise. **The contracts did not improve this
model on this task**, and the CONTRACT arm is nominally lower rather than higher.

No endpoint is reinterpreted. This is the result.

## What actually went wrong is not precedence

Every output parsed. The dominant failures are in neither arm's favour and have nothing to do with the
thing the contracts represent:

    SCOPE CREEP          def classify(n): ... if n < 10: return "small"  return "large"
                         6/10 BASELINE-A. A new behaviour nobody requested, replacing the
                         preserved "positive".

    DELTA NEVER MADE     def classify(n): if n < 0 ... elif n == 0 ... else: return "positive"
                         6/10 CONTRACT-A. Valid Python, the original semantics, the requested
                         change simply absent.

    GUARD SWALLOWS       pos=small — the new predicate captured inputs it should not have.

Precedence was almost never the deciding factor. `contested=zero` dominates **both arms and both
cases**, which is the source-order default: appending after the existing zero check. In case B, where
the contract states outright *"On inputs where both apply, the result must be 'small'"*, only 1 of 10
CONTRACT samples produced it — against 2 of 10 for BASELINE.

**So the ruling was communicated and not acted on.** The contract was leakage-clean and differed from
case A by exactly one sentence, verified before the window opened. The model did not use it.

## The honest reading

For a 1.5B at this task, **representing intent is not the binding constraint**. Basic obligation-
following is: keeping scope, and making the requested change at all. A contract cannot help a model
that adds an unrequested `"large"` branch or returns the original function unchanged.

That does not retire the contracts — it says this experiment cannot see their value, because a prior
failure mode dominates. The v7 machinery stands on its own witnesses, where it is tested directly and
passes.

One hypothesis worth naming and NOT claiming: the CONTRACT package is abstract prose about
obligations, and the 1.5B may act less reliably on it than on a direct imperative. `small=positive`
appears 6/10 in CONTRACT-A and 0/10 in BASELINE-A, which is suggestive. At n=10 it is a hypothesis for
a future arm, not a finding.

## Power, stated as preregistered

40 generations. A mechanism check, not a rate estimate — a rule-of-three bound near 26% on a clean
0/10. A one-or-two sample difference is inconclusive and is reported as such. The *failure-mode tally*
is the part of this run worth keeping, and it is qualitative.

## What this costs the roadmap

The next useful experiment is not another contract arm. It is whether the 1.5B can be held to scope at
all — and that is what LegaGate and the bounded-authority work exist for. The model needs the
obligation enforced, not merely stated.
