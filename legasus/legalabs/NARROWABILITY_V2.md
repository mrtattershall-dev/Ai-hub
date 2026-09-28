# NARROWABILITY V2 — preregistered before implementation

**V1 denominators are frozen and are never rewritten.** Gate 7's recorded result stays exactly as it
is: one over-constraint on `scopecont`, under Narrowability V1. V2 is a new measurement version, used
only for families authored after it exists.

## Why a second channel is needed

`j01:op3` removes a position where inserting a class-level `def` ends `resolve` early and re-parents
its remaining statements onto the new definition. The program **is** damaged. The sealed probes never
call the damaged path, so V1 records the position as passing, and a correct structural rule is scored
as an over-constraint.

That collides with a standing Legasus rule:

> **LegaVerify must not certify behaviour its probes cannot observe.**

Under V1, LegaVerify would punish LegaCore for correctly preserving structure, because the test suite
is thin. What the executable sweep actually produces is not ground truth simpliciter — it is

> **ground truth relative to the observable contract.**

When that contract is incomplete, execution gives a false reading of legality.

## The two channels

A candidate position is legal only if **both** agree.

    BEHAVIORAL CHANNEL                    STRUCTURAL CHANNEL
      loads                                 pre-existing statements keep their parent
      preservation probes pass              none becomes orphaned or re-parented
      requested delta passes                no reachable statement becomes unreachable
                                            structure outside the granted edit is preserved

The structural invariant, stated narrowly and mechanically:

> Inserting the operation must not change the structural parent or the reachability of any
> **pre-existing** statement outside the granted edit.

## The oracle must be INDEPENDENT of `ownership_boundary`

Letting the rule under test define its own oracle is circular. LegaCore says *"this position violates
ownership"*; the evaluator must independently observe *"these pre-existing statements changed parent"*.
Two different mechanisms reaching the same verdict is evidence; one mechanism consulted twice is not.

So the structural channel compares an **observed structure signature** of the program before and after
the candidate insertion. It contains no indent arithmetic borrowed from the deriver:

    identity      a pre-existing statement is identified by its trimmed text and its occurrence index
                  among identical texts - stable under the line-number shift an insertion causes
    parent chain  the sequence of enclosing construct headers, read from the text
    reachability  whether a terminator at the same indent precedes it within its own block

Inserted lines are excluded from the comparison: the operation is allowed to add structure. Only
pre-existing statements are checked.

## Witnesses required before V2 is used

| | Case | Expect |
|---|---|---|
| REJECT | insertion ends a method early and re-parents the remaining statements | structural violation |
| REJECT | insertion moves existing code behind a terminator | structural violation |
| ADMIT | sibling insertion that shifts line numbers but preserves every parent and reachability | clean |
| ADMIT | intentional new nested code, with pre-existing statements structurally identical | clean |
| NON-VACUITY | known-good candidates from an existing family still pass | clean |

A checker that rejected everything would fail both ADMIT cases and the non-vacuity check.

## Use, and what is forbidden

- V2 applies to families authored **after** it exists.
- V1 denominators stay frozen. Gate 7's one over-constraint is permanent history.
- V2 may be run over old families **descriptively**, reported as *"under the later structural oracle
  the disputed position is independently classified as invalid"* — a supersession notice, never a
  rescore.
- `ownership_boundary` is **not** weakened. The architecture was more correct than its evaluator here,
  and the evaluator is what changes.
