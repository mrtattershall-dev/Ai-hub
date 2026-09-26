# INC4-1 DEFINITION — one named handler, with a stopping rule

Frozen 2026-09-26 before any run. **$0: local ollama only. No paid run is authorized and none will
be launched.** The 7B cells stay AUTHORIZED at $3 but HELD and unlaunched.

## The question

INC2-1 and INC3-1 spent thirty-five attempts on increment 2 (planting **and** growth over an
existing page) and produced no implementation. The useful next result is **one accepted functional
addition**, so the unit of work shrinks to a single handler with its negative clause stated as
plainly as its positive one.

## The task: `farm-plant`

> One change only: make the p key plant. When the player's tile is empty AND `inventory.seeds` is
> greater than zero, add a tile entry `{ crop: 'wheat', stage: 0 }` at the player's tile and reduce
> `inventory.seeds` by exactly one. In every other case — the tile already has a crop, or there are
> no seeds left — p must change nothing at all. Do not add growth, harvesting or saving. Do not
> change how the arrow keys move the player.

It starts from `NARROW-2_accepted_index.html` and depends on `farm-i1`. The request deliberately
does **not** re-list the other keys; `play-plant.json` carries a contract stating the state shape
and nothing else, so the model is not handed the whole feature list again.

## Checked, and checked apart

    requested (steps 1-6)   loads and exposes state; arrows move; p plants on an empty tile and
                            spends EXACTLY one seed; p again on the same tile changes nothing;
                            with seeds exhausted p changes nothing
    protected (steps 1-3)   movement and existing behaviour, measured SEPARATELY from the handler

**The spec was validated against mutants before any model saw it** (`farmPlantSpec.test` 12/12):

    a correct handler                        6/6 pass
    the accepted page, unchanged             1,2,3 pass; 4 and 6 fail
    plants but spends no seed                step 4 fails
    replants on an occupied tile             step 5 fails
    plants with no seeds left                step 6 fails
    plants correctly, breaks the arrow keys  steps 2,3 fail while step 4 still passes

**One weakness recorded rather than hidden:** step 5 ("p again changes nothing") is *vacuously*
satisfied by a page where p does nothing, which is why the untouched starting page passes it.
Steps 4 and 6 are not vacuous — both require a seed to have been spent — and the requested set
demands all six, so the negative clause only carries weight alongside them. **A do-nothing
candidate cannot pass this task.**

## Three cells, five seeds each, differing only in what the model is asked to emit

    cell          interface                                    who chooses the edit site
    A  fim        fill a 5-line hole where the p wiring was     the HARNESS
    B  anchor     emit FIND/REPLACE blocks                      the MODEL
    C  whole file return the complete index.html                n/a (no site; full rewrite)

Cell C is included because the feature, not only the interface, has changed: it asks whether a
narrower request alone lifts the whole-file echo that INC2-1 found.

## Assistance ledger

Every cell: the harness supplies the output FORMAT; the feature is already one step, so **no
further decomposition is applied**; the observability seam exists in the starting file. Cell A
additionally gets **the site, chosen by me**, plus an instruction comment recorded verbatim.
**Cells A and C measure the model plus that help. Only cell B asks the model to choose its own
site.** If cells A or C succeed and B does not, what exists is an assisted code generator, and
choosing the site remains unbuilt work for the manager.

## Stopping rule

- **Five seeds per cell, one attempt per seed. No retries, no reseeding, no prompt tuning
  mid-cell.**
- Per run: `--deadline-sec 900`, `--max-tokens 1500`. A correct handler is about 150 tokens, so
  1,500 is a tenfold allowance; INC3-1's 4,000-token comment loops burned seven minutes each to
  emit nothing, and cost and stutter are product requirements.
- **Stop the whole localized-edit line if all three cells produce zero accepted AND no cell
  inserts code in any of its five attempts.** In that case the next move is not another protocol
  variant at this size — it is a decision about the model, taken with fresh authorization.
- **Stop early and report if any cell reaches an accepted candidate**, since one accepted
  functional addition is the result being sought.

## Pre-registered readings

- **One accepted addition** in any cell: the builder has extended its own accepted work for the
  first time. The next question is immediately whether the system can choose the site and the
  step itself, which is cell B's question and the manager's.
- **Code that fails the clauses** (planting without spending, replanting, ignoring the seed
  count): the model can write the handler and not respect the negative clause. That is a
  diagnosable behaviour failure and the recovery controller's proper input.
- **No code at all**, as in INC3-1's five-line cell: narrowing the feature did not help either,
  and the stopping rule above applies.
- **B fails while A or C succeed**: site selection is the missing capability, and it stays a
  manager problem rather than a generation problem.

Records to `legasus/screen/INC4-1_{fim,anchor,whole}_seed*.json`.
