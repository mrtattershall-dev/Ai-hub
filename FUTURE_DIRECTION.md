# FUTURE END GOAL — coordinated control of physical operations

**Status: recorded aspiration. Not a claim, not a commitment, not in any current scope.**

This is **not** consolidation scope, **not** the R4 freeze, and **not** the recovery controller. It is
written down so the long-horizon target stops living only in conversation, and so that the distance
between it and current evidence stays explicit rather than implied.

## The target

Legasus observing how **robots, conveyors, queues and control software interact**, then proposing
**coordinated adjustments** across the system.

The worked example, because it carries the whole idea: a conveyor feeds a junction faster than the
downstream robots can clear it. **Slowing that conveyor slightly could raise total throughput** — fewer
jams, fewer recovery stops. Every machine individually slower; the system faster.

    the objective is RELIABLE FLOW ACROSS THE WHOLE SYSTEM,
    not MAXIMUM SPEED FOR EACH MACHINE

That is the same shape as LegaProgress in the software domain: every local instrument can report success
while the thing as a whole fails to advance. A conveyor running at maximum rate is locally optimal and
globally wrong, exactly as a week of verified refactoring is locally correct and builds nothing.

## Why this is a SEPARATE engineering milestone

Not a larger version of software repair. A different problem with different preconditions:

- **Machine telemetry and authorized control interfaces.** Neither exists here today.
- **Simulation first, then bounded trials.** Not straight to a live line.
- **Independent safety controls enforcing speed, spacing and emergency-stop limits.** Independent
  meaning *not* the proposing system, and *not* derived from it.
- **Learning that accounts for changing loads, equipment wear and uncertainty** — a model fitted to one
  load profile on new equipment is fitted to a world that no longer exists six months later.

## THE ASYMMETRY THAT GOVERNS EVERYTHING HERE

> **A software rollback cannot undo a physical collision.**

Every safety property this architecture currently relies on is *recoverable*: DISCARD restores a verified
checkpoint, invalidation propagates, a bad commit is revertible. **None of that transfers.** The whole
recovery-based discipline is available only where the effect is undoable, and a physical line is the
regime where it is not.

Therefore the standing constraint, which must not be softened later for convenience:

    the network may PROPOSE optimizations
    it operates INSIDE ENFORCED SAFETY LIMITS
    the limits are enforced by something that is not the proposer

## What current results DO and DO NOT establish

**Do not establish industrial-control capability.** The repair results are software repair on software
subjects, and nothing about them transfers to actuated machinery. Specifically:

- the controller's evidence is repair economics on QuixBugs-style tasks;
- r4's only prospective test returned CAPABILITY 0/3;
- the consolidated system has not yet been shown to connect end to end at all.

**Two words to never use for this, however good the results get:**

    "OPTIMAL"                  a stronger claim than any measurement here could support
    "PREVENTS ALL CRASHES"     unfalsifiable in the direction that matters, and false in practice

## The useful, defensible target

    measurably FEWER JAMS AND STALLS
    better THROUGHPUT
    NO COMPROMISE TO SAFETY

Three measurable things, each independently checkable, none requiring a claim about optimality or about
the absence of failure. The safety clause is not a metric to trade against the other two — it is a
constraint the other two are measured *inside*.

## Placement note

Written into this worktree because it is the active checkout, committed **alone** so it can be moved,
cherry-picked or dropped without touching consolidation work. It belongs wherever long-horizon direction
is kept; it does not belong to this branch's claim.
