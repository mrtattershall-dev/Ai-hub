# Mode authorization — A1..A6. Frozen 2026-09-21, before any authorization code exists.

## The question

> Can the system prevent **the party seeking admission** from choosing which burden of proof applies?

Modes demonstrably change behaviour. The remaining hazard is that a caller selects a weaker
requirement while the outcome still reads as fully licensed.

## The trust decision, made explicitly rather than assumed

Two positions are available and they are not interchangeable:

1. **The runtime author owns the acceptance policy.** Then choosing the mode is legitimate, and the
   outcome must still say whose policy it was.
2. **The runtime must enforce an independently fixed obligation.** Then accepting the caller's
   choice is an unauthorized reduction of that obligation.

**This run takes position 2 for anything that reaches admission**, because every step of this
sequence has removed a path by which the party seeking admission chooses its own burden — `requires`
in v1.2, rule authority in v1.3, the producer-declared mode in T7. A caller is closer to the producer
than to the registry, and treating its ask as authority would reintroduce the defect one layer out.

**And the honest limit:** moving the field into the registry helps **only if** the registry's
ownership and enforcement actually establish that boundary. They are not established here. No
registry rule may be added or changed in this run, so the governing obligation is still supplied at
the call site — it is merely **separated** from the request, named in the outcome, and refused as a
substitution. **That separation is a smaller claim than registry ownership and must not be reported
as it.**

## The two channels, frozen

    governing   the authorized obligation. Decides. Named in every outcome it decides.
    requested   what the party seeking admission asked for. RECORDED. Never decides.

**No strength lattice is invented.** DESIGNATED, EXISTENTIAL and COMPLETE are not totally ordered —
DESIGNATED needs no completeness, COMPLETE needs it absolutely, and neither is simply "stronger".
So the rule is not "refuse weaker requests"; it is: **any requested mode that differs from the
governing one is refused as a substitution and recorded as refused.** Sameness is decidable;
strength is not, and inventing an order would be inventing a distinction reality has not demanded.

## The outcome must say three things

Every outcome that turns on an obligation names:

    obligation.relation      which obligation this was
    obligation.mode          the mode actually enforced
    obligation.governedBy    the basis on which that mode was accepted
    obligation.requested     what was asked for, if anything
    obligation.requestAccepted   always false when it differs from governing

**Recording the caller's requested mode alone would document the choice without authorizing it** —
which is the whole point, and is why `requestAccepted` is a separate field rather than an inference.

## The arms

| arm | required boundary |
|---|---|
| **A1** caller changes `DESIGNATED` to `EXISTENTIAL` | cannot satisfy the original designated obligation through substitution; the refusal names both modes |
| **A2** caller omits the mode | cannot silently inherit a weaker default than the governing obligation |
| **A3** replay changes the mode | a replay run under a different governing obligation **cannot be presented as reproduction of the same admission contract** |
| **A4** merge combines different modes | two consumers whose claim strings match but whose governing obligations differ are **not collapsed**; each is enforced on its own terms |
| **A5** mode honored in only one branch | every admission path enforces the same authorized requirement — the reference path, the single-candidate claim path and the multi-candidate claim path |
| **A6** origin stability *(carried from T5)* | the stable order over `(origin, ref)` is reproducible **only if those coordinates are stable across the permutations being compared**. Origins are merger-assigned, so an origin derived from input position would reintroduce the provenance dependence T5 fixed, under different labels |

## Predictions, committed now

- **A1, A2** I expect to hold once the channels are separated, and to be trivially violated before
  that — today `witnessModes` is a single channel, so a caller *is* the policy. The previous run's
  parameter is hereby named as the **governing** channel; the request channel is new.
- **A3 is where I expect the first failure.** Nothing today records which obligation contract an
  outcome was produced under, so two runs under different governing tables are indistinguishable
  after the fact. That is exactly the shape of the replay defect R3 guarded against, one level up:
  a result that looks like reproduction because nothing recorded what it was reproducing.
- **A4** I expect to need real work: the governing table is keyed by relation, so two consumers
  sharing a claim string share an obligation by construction. Keying per record is the obvious fix
  and it must not become a way for a consumer to name its own key.
- **A5** I expect to hold, because T3/T6 already caught a half-wired mode — but the reference path
  has never been asserted under a governing obligation, so it may not.
- **A6** I expect to hold **for the current tests**, which label origins A/B/C by hand, and to be a
  live hazard for any caller that labels origins by position. I expect to record it as a hazard with
  a demonstration, not to fix origin assignment here.

## Forbidden in this run

No registry rules added or changed (still **3 authored, 0/15**). No strength lattice. No exhaustion
mechanism. `COMPLETE` stays unsatisfied. **S6 stays preserved and untouched.** No freshness rule. No
repair of the F2 boundary. The default stays exactly as T1 pinned it: an absent governing mode means
the unnamed hybrid, not a newly invented mode.
