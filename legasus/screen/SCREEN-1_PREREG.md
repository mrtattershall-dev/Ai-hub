# SCREEN-1 — preregistration, frozen BEFORE any Odysseus source is read (2026-09-21 10:30)

Target record: `legasus/screen/TARGET-ODYSSEUS.md` (329201c), which states that at freeze time no
source file had been read and no defect, location or area had been selected. **That remains true
at the moment this document is committed.**

## The trophy condition this attempt is aimed at

> Frozen general machinery identifies a previously unknown live defect in independently
> developed external software, without selecting the defect or location after inspection, and
> the finding survives independent diagnosis.

This attempt can satisfy at most the first three clauses. Independent diagnosis is tatte's to
arrange and is not something I can supply.

## Provenance of the invariants — why these and not others

Both invariants below were **discovered by Legasus on other codebases, before Odysseus was
named as a target**, and are recorded in this project's own history:

- **INV-A** generalises *"a failed sample is not a low sample; a zero is suspect"* and *"absence
  of evidence read as evidence of absence"* — the rule that made `verdict()` treat `null` as
  never-passing, and the defect class behind the tasklist-returns-zero incident.
- **INV-B** generalises *"a checker branch that cannot fail"* — `[].every()` is true, and an
  unhandled type returned `ok: true`, so a broken artifact scored a full pass.

Neither was chosen by looking at Odysseus. That is the point of freezing them here.

## INV-A — a failure path must not produce the success value

    A function contains an `except` handler whose body returns a value that the same function
    also returns on a non-exception path used to signal success.

Narrowed for mechanical decidability and signal:

    FLAG when a function has BOTH
      (a) at least one `except` handler that returns a truthy literal (True, or a non-empty
          literal), or falls through to a shared success return, AND
      (b) at least one `return False` / `return None` elsewhere in the same function
    i.e. the function distinguishes success from failure, and its ERROR path reports success.

## INV-B — a predicate must be able to fail

    A function whose name marks it as a check (`is_`, `has_`, `can_`, `should_`, `validate_`,
    `check_`, `verify_`, `ensure_`) has NO reachable path returning a falsey value.

    FLAG when such a function contains at least one `return` of a truthy literal and NO
    `return False`, `return None`, bare `return`, or `raise` anywhere in its body.

## What counts, and what does not

A **candidate** is an AST hit. A candidate becomes a **finding** only if, on reading that
function, the flagged path is genuinely reachable and genuinely reports success for a failure.
Everything else is recorded as a false positive **with its reason**, and the false-positive rate
is reported — a screener whose precision is unstated is not a screener.

A finding becomes **live** only if a code path containing it executes during Odysseus's own test
suite, which tatte has explicitly authorised running.

## Frozen before results

1. **No second invariant may be added after seeing hits.** If INV-A and INV-B produce nothing
   usable, SCREEN-1 reports zero findings. Adding INV-C afterwards would be selecting the
   detector to fit the target.
2. **No area of the codebase may be excluded or focused after seeing hits.** The scan covers
   every `.py` file outside `venv/`, `node_modules/`, `__pycache__` and `tests/`. Test files are
   excluded **now, before running** — a vacuous assertion in a test is a different defect class
   and INV-B would flag test helpers en masse.
3. **Ranking is frozen**: candidates are reported in file-path order, not by how interesting
   they look.
4. **Predictions.** INV-B produces more candidates than INV-A. Most INV-B candidates are false
   positives, because a predicate that always returns truthy is often correct by construction.
   INV-A's precision is higher and its volume much lower. If INV-A yields more raw hits than
   INV-B, my model of these invariants is wrong and that is reported.

## Constraints

Target tree read-only; modification would be checked and is not permitted. Findings go to tatte
only — **nothing is published, filed upstream, or sent anywhere.** Executing the suite is
authorised; configuring credentials, network endpoints or MCP servers is not.
