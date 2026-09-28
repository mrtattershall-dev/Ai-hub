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

## CORRECTION TO A CLAIM MADE BEFORE THIS RUN

`TRANSFER_2_PREREG.md` and commit `9e28496` both say the per-entry cost fell from ~8s to <1s and
that "that 8s was the fall-through". **The preregistration is frozen and is not being edited; the
correction belongs here.**

The 8s was measured while my own leak was running. ai-native-engine-75 calibrated the machine after
it was cleared: the BIND-1 workload reads 808.5ms unloaded (min of 5, JIT warmed, 9 processes) against
~1500ms under today's load — **an inflation of ~1.85x**. So the 8s figure is inflated by roughly that
factor before the fall-through is counted at all.

The fall-through is still the dominant cause, and the direction of the claim holds. **The magnitude
does not**, and "that 8s was the fall-through" attributes to one cause a number that two causes
produced. The split is unmeasured and is not being estimated after the fact.

The numbers in this result are unaffected: the regression (200s) and TRANSFER-2 (456s) were both run
after the cleanup at an 8-process baseline.

**Anything either session calibrated or timed today against a "today's numbers" reference is
anchored ~1.85x high**, which is a fact about the machine and not about any subject.

## SECOND CORRECTION — U-4's "forward = 0" WAS WRONG, AND THE HEADLINE IS NARROWER

Raised by ai-native-engine-75 reading this result. It is right, and the mechanism has been repaired
rather than only the wording.

**Forward discovery did not find nothing. IT COULD NOT LOOK.** Its precondition is at least one
identity brand to seed on, and the hub has none. A mechanism whose precondition is absent reported
its own inapplicability, and recording that as `0 candidates` invites a reader - including me, later
- to treat it as evidence that the hub HAS no authority surface. That is absence of observation
becoming evidence of absence.

    was        forward only (brand-seeded)   0
    should be  forward                       UNOBSERVABLE (precondition absent: no identity brand)

**And the intersection line is not a result either.** An intersection of 0 between a populated set
and an UNMEASURED one is not two methods disagreeing; it is one method, unwitnessed by the other. On
Legasus, 10 and 39 were both populated and genuinely disjoint - that IS a result about two surfaces.
The hub number is not the same kind of object and must not sit in the same column.

    hub INTERSECTION   UNDEFINED, not 0

**The honest headline is narrower than "it transferred":**

> **BACKWARD discovery transferred.** Forward discovery is UNTESTED on this subject, because a
> subject that cannot exercise half a mechanism has not tested that half.

That is a scope statement, not a retreat: the backward half reaching a foreign subject is a real
result and is not improved by a claim the run cannot support.

**What this project already knew, and violated anyway.** `supportFormula` returns UNKNOWN below two
constructed inputs. `observability` returns UNOBSERVABLE_BY_THIS_INSTRUMENT rather than counting a
CommonJS module as examined-and-empty. The same distinction, made correctly twice in this codebase
and then broken in a third place by the session that wrote both.

`discover()` now returns `forward: MEASURED | UNOBSERVABLE` with its reason, two controls pin it (no
brand yields UNOBSERVABLE; a populated seed yields MEASURED, so UNOBSERVABLE cannot become the
constant answer), and the runner prints INTERSECTION: UNDEFINED when either surface is unmeasured.
**TRANSFER-2's numbers stand as recorded** and the frozen preregistration is untouched; the mechanism
change means any future hub run is TRANSFER-3.

## AND THE 1-OF-4 IS PROBABLY THE MORE IMPORTANT RESULT

    backdoor detector, fixture                1/1      recall 1.0
    backdoor detector, first real specimen    1/4      recall 0.25

The fixture was drawn from the same generative process as the detector, so it could only confirm it:
**it measured the fixture, not the phenomenon.** The other three were never represented in the thing
that validated it - the recall-side twin of the vacuity problem this project has been chasing on the
precision side all along.

The uncomfortable generalisation, and it is not about one detector: **every probe set in this
repository was validated the same way.** That this number came out 1/4 rather than 4/4 is luck about
which specimen arrived first, not a property of the method. The only remedy demonstrated here is the
one that happened by accident - meet a real subject early and let it say 1/4 out loud.

## THIRD CORRECTION — the 1-of-4 cause is now MEASURED, and my explanation of it was wrong

This result said: "The structural rule requires at least half an aggregate's properties to reference
bindings the module does not otherwise export; three of the four did not meet it. Whether those three
are genuinely different in shape or the threshold is simply too strict is UNMEASURED."

Measured now. **THE THRESHOLD HAS NOTHING TO DO WITH IT.**

    __modelCallTest    CAUGHT    callModel, pruneHistory, capMessage, ...      bare identifier refs
    __toolPolicyTest   MISSED    autoTools: () => new Set(AUTO_TOOLS)          arrow-wrapped
    __godotToolTest    MISSED    collect: (root) => collectGodotFiles(root)    arrow-wrapped
    __supervisorTest   MISSED    brake: (item) => supervisorBrake(item)        arrow-wrapped

`testBackdoors` collects `properties.filter(pr => pr.value.type === 'Identifier')`. The three misses
wrap their private binding in an arrow, so their value nodes are `ArrowFunctionExpression` and are
filtered out entirely. Their property list comes out **EMPTY**, and the guard `agg.props.length &&
...` then declines before any threshold is consulted. A getter (`get planTaskFor() {...}`) is dropped
the same way.

So the detector recognises **re-export by REFERENCE** and not **re-export by WRAPPER**. Both expose
the same module-private binding; one does it through a closure.

**AND THAT IS THE SAME DEFECT AS EVERYTHING ELSE TODAY.** An incidental property of the
representation - whether the author wrote `callModel,` or `callModel: (x) => callModel(x)` - was
allowed to decide a semantic classification. It is the readable brand, the name-keyed admission, the
consumer-count backdoor rule and `String(v)` again, in the detector written to find that family.

**NOT FIXED.** Widening the rule to count wrapper bodies would be fitting it to the three specimens
that exposed it, and the honest sensitivity number is the one measured BEFORE the fix. What changes
here is only that the cause is known:

    1/4, cause UNMEASURED     ->    1/4, cause MEASURED: wrapper indirection, not threshold

A repair needs its own preregistration, with a falsifier and a specimen set not drawn from these
four - otherwise the next recall figure measures the fixture again, which is the finding that
started this.
