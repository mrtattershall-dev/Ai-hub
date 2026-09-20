# r4 — TRANSFER-2. RESULT: it transferred. Forward discovery found ZERO on the hub; backward found 40.

Preregistered in `TRANSFER_2_PREREG.md`. Mechanism frozen at `BACKWARD_2_FROZEN.txt`, COMBINED
`0784cd3f4e3970b3`, verified before the run. Clean room outside the hub repository, rebuilt fresh.
90 entries, 456s, on a machine at an 8-process baseline.

## Every coordinate, reported separately

    U-1  effects witnessed                        HELD      4498
    U-2  ancestry crosses PRIVATE production code HELD      11 private functions
    U-3  backdoor detector fires naturally        HELD      1, with a sensitivity bound below
    U-4  backward recovers what forward cannot    HELD      forward 0, backward 40
    U-5  lifecycle no longer controls the observer HELD     NO_RECORD 0, swept 0
    U-6  the CommonJS region is in the denominator HELD     first firing on a real subject
    U-7  the dangerous null                       NOT TRIGGERED
    U-8  no hub defect found or reported          held

## U-4 IS THE RESULT

    forward only (brand-seeded)        0
    backward only (sink-seeded)       40
    INTERSECTION                       0

**Forward discovery found nothing at all.** Not "few" - zero candidates, because the hub has no
identity brand for the brand-shape seed to find. On Legasus the two surfaces were disjoint but both
populated (10 and 39). On a repository that was never built around this ontology, the forward
direction returns an empty set and the backward direction returns the whole surface.

That is the transfer question answered. A screen seeded only on explicit authority machinery is a
mirror; this repository holds nothing up to it.

## U-2 — eleven private functions, reached through effects

    queue.js::withLock            queue.js::enqueueLocked      queue.js::dequeueLocked
    queue.js::completeLocked      queue.js::load               queue.js::save
    workspaceGit.js::clearStaleLock   safeJson.js::quarantine
    verifyProject.js::walk        taskLedger.js::write

Locking, quarantine, ledger writes, stale-lock clearing. Authority-bearing by any reading, none of
them exported, and **none reachable by any forward method.** They are candidates because they
participated in a witnessed effect.

**PARTICIPATION, NOT RELEVANCE.** A stack is coarse causal participation, not counterfactual
dependence. Nothing here establishes that any of these eleven matters to the effect it appears under.

## U-3 — the detector's first natural specimen, and its sensitivity bound

    TEST BACKDOORS DISCOVERED BY STRUCTURE: 1
        agent.js::__modelCallTest

It had only ever fired on a fixture I wrote. It fired here, unprompted, on an aggregate of
module-private bindings, with no name supplied to the mechanism.

**And it found ONE of four.** The hub has `__toolPolicyTest`, `__godotToolTest`, `__modelCallTest`
and `__supervisorTest`. The structural rule requires at least half an aggregate's properties to
reference bindings the module does not otherwise export; three of the four did not meet it. Whether
those three are genuinely different in shape or the threshold is simply too strict is **unmeasured**,
and until it is measured this detector's sensitivity on real specimens is bounded by 1/4, not by the
fixture's 1/1. A detector validated only on constructed examples flatters itself, which is why the
natural specimen mattered.

## U-6 — the coordinate that had never fired

    OBSERVABLE                        148
    UNOBSERVABLE_BY_THIS_INSTRUMENT    10
    NO_MODULE_SYNTAX                   17

Legasus is 100% ESM, so this read 260/0/0 there and was pure decoration. **27 of 175 hub modules are
outside what this instrument can see at all.** The loader substitutes ES modules; a CommonJS module
is not unmeasured, it is unobservable by this technique, and no coverage figure here divides by 175
as though those 27 were examined.

## U-5 — and the confirmation of what killed TRANSFER-1

    COMPLETE            25
    REFUSED              1
    SUBJECT_TERMINATED  64
    DRAIN_INCOMPLETE     0
    TIMED_OUT            0
    NO_RECORD            0
    children swept       0

**64 of 90 entries ended the process themselves.** That is the behaviour that killed TRANSFER-1 on
its second entry, now a coordinate instead of a silence. Every entry is classified, none is silently
absent, nothing had to be reaped, and no child outlived the run.

## THE COST OF THAT, STATED PLAINLY

64 entries are `EFFECTS UNESTABLISHED`. Their observations are real, but whether they finished is
not established, so **for 71% of this repository's entries the question "did it cause nothing?"
cannot be answered.** 4498 is a floor, not a count. A report that presented it as a measurement of
the hub's effects would be claiming more than the run supports.

## U-7 — nothing was named, and the backdoor was detected rather than used

The only inputs were six sink CLASSES and twelve Node platform boundaries. No hub file, function or
API appears in the configuration. The one test-only export the run found was **reported as a
finding about the subject, not used as a way in.**

## Conditions honoured

The hub repository was never executed, never written to, and never had a process started inside it.
Verified after the run: no file under it has an mtime inside the run window except `COORD.md`, which
is the peer sessions' coordination file and is not something this runner touches. Clean room
discarded. Machine returned to an 8-process baseline with 0 of mine remaining.

## What this still does not establish

SUPPORT_CHARACTERIZED, JUSTIFICATION_ESTABLISHED and SCREENED are all unreached. Nothing about the
hub's correctness. The eleven private functions are participants, not established dependencies.

    stage reached:  EFFECT_DISCOVERED / EFFECT_WITNESSED / ANCESTRY_OBSERVED
    not reached:    SUPPORT_CHARACTERIZED / JUSTIFICATION_ESTABLISHED / SCREENED
