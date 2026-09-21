# Stage B result — H-INFO is NOT discriminated. Two independent reasons, both against it.
2026-09-21. Target `pytorch/pytorch @ 9b6e45278f06`, cases selected by the frozen rule, P/R/E/D
frozen at adbee47 before diagnosis. Raw: `legasus/out/stageb/stageb_diagnosis.json`.

## Observations

    case 1  gh_summary_path    SET_unwritable -> R=Path, decision proceeds, D says the write fails
    case 2  local_image_exists UNOBSERVABLE - the docker package is absent, so D cannot be opened
    case 3  validate_cuda      EMPTY and WHITESPACE -> R=True, warning suppressed, D says invalid

On the face of it, wrong entitlement in both testable cases, exactly where collisions were
predicted. **Both fail on inspection, for different reasons.**

## Case 3 — a shallower account I failed to list predicts it

`validate_cuda("")` returns `all([]) == True`. The **vacuous truth of a quantifier over an empty
collection** predicts this case completely, and it is far shallower than H-INFO.

That account was **not among the four I froze in B3** (cardinality, exception handling, boolean
polarity, test structure). My list was incomplete, and the omission favoured my own hypothesis.
B3's rule is explicit: *if any shallower account predicts the same failures, H-INFO is not
discriminated.* One does.

> **Case 3: NOT DISCRIMINATED.**

This is the same family Legasus recorded long ago as *a checker branch that cannot fail*
(`[].every()` is true). I had that specimen in my own history and still left it off the list.

## Case 1 — the verdict was decided by my choice of `P`, not by the code

The decision is:

```python
if not gh_summary_path():
    return logger.info("Skipping, not detect GH Summary env var....")
```

Two defensible framings, with **opposite** verdicts:

    P = "a summary path is configured"        UNSET/EMPTY -> None, SET -> Path
                                              NO collision, NO wrong entitlement
    P = "writing the summary will succeed"    SET+writable and SET+unwritable both -> Path
                                              COLLISION, wrong entitlement

I froze the second. The first is at least as faithful to what the decision's own predicate
claims — the function is documented as *"the Path ... or None if not set"* and never promised
writability.

The downstream hazard is real: `write_gh_step_summary` does `with sp.open(mode) as f` with no
guard, and the caller runs inside a `finally:`, so an unwritable path raises there and can mask
the original exception. But that is a property of the **writer**, not of this decision.

> **Case 1: the collision exists only under a P that I chose. NOT DISCRIMINATED.**

### And this is the more important finding of Stage B

H-INFO's predictions are **relative to `P`**, and `P` is selected by the analyst. The same code,
the same representation, and two reasonable framings give opposite answers about whether a
distinction was erased. A theory whose predictions move with a free choice by the person applying
it is weaker than it looked at Stage A, where I supplied `P` inside a construction built around
it.

That is not a refutation of H-INFO's necessary-condition form. It is a demonstration that
**H-INFO is not self-applying**: it cannot be used without an independent discipline for fixing
`P`, and this branch does not have one.

## Scoring against the frozen protocol

    B1  collisions predicted in all three; two testable cases showed wrong entitlement, but
        neither survives scrutiny as evidence FOR H-INFO
    B2  NOT TESTABLE - the frozen rule's first three cases all collide; no paired
        non-colliding case was available, and re-ranking to find one was refused
    B3  FAILS for case 3 - a shallower account predicts it, and my list of shallower accounts
        was incomplete in my own favour

    => H-INFO is NOT DISCRIMINATED on a naturally occurring case.

## What Stage B did establish

- **H-INFO's standing is unchanged from Stage A**: one discriminating result against H-RICH on an
  author-built construction, and nothing on a natural case.
- **A new and specific weakness**: the `P`-relativity above, discovered by a target that
  contributed nothing to the theory. This is what an external corpus is for, and it is the third
  time one has found something the author's own constructions could not.
- **Case 2 remains genuinely open.** It is the one with the font case's exact shape — `False`
  meaning both *established absent* and *unknown because the API errored* — and it is
  UNOBSERVABLE here rather than resolved.

## What was NOT done

No case re-ranked, no P re-framed to rescue a verdict, no shallower account added to B3 after the
fact to make the failure look anticipated. The incompleteness of my own B3 list is reported as
the reason case 3 fails, not worked around.
