# The append_file preservation bypass: reproduced, fixed, and verified

One functional line changed. What follows is the evidence that the line is sufficient for the cases
tested and the statement of which cases were not tested.

Branch `fix/append-preservation`, cut from `fix/unverified-finish-recorded` @ `c952cbc` so the
before/after comparison holds the revision constant. Measured with
`measurements/replay/replay-run.mjs` pointed at each worktree's `server/index.js` in turn — isolated
hub per scenario, own port, own workspace, mock model serving fixed replies, no GPU.

## THE DEFECT

Both preservation refusals are gated on `beforeSrc`, which `agent.js:3392` captured only for
`write_file` and `edit_file`. `append_file` therefore had no before-image, so the duplicate refusal
(`defCounts`, `agent.js:3505`) was not weakened on that route — it was **unreachable**.

Reproduced on the unmodified revision before changing anything:

    write_file   makes foo go 1 -> 2   REFUSED, file unchanged
    append_file  makes foo go 1 -> 2   LANDED,  def foo x2

## THE FIX

    -  if ((tool === 'write_file' || tool === 'edit_file') && args.path && ...
    +  if ((tool === 'write_file' || tool === 'edit_file' || tool === 'append_file') && args.path && ...

Nine words. The surrounding comment records why, what was measured, and that the removal refusal is
expected to be vacuous on this route because appending cannot remove a definition.

## VERIFICATION — 9 CONTROLS, 3 THAT MUST REFUSE AND 6 THAT MUST NOT

Every expectation was written down before the fix was applied. Scored against **on-disk file state**,
not against counters, because the file is the ground truth and a counter is a report about it.

    control           what it does                              BASELINE        FIXED
    ────────────────────────────────────────────────────────────────────────────────────────────
    ap1-DUP-PY        append duplicates foo in .py              foo x2  LANDED  foo x1  REFUSED
    ap2-DUP-JS        append duplicates jfoo in .js             jfoo x2 LANDED  jfoo x1 REFUSED
    am1-METHOD-DUP    append duplicates an INDENTED method      x2      LANDED  x1      REFUSED
    ap3-NEWDEF        append a genuinely new definition         lands           lands
    ap4-NEWFILE       append to a file that does NOT exist      lands           lands
    ap5-NONSOURCE     append to NOTES.md (outside the gate)     lands           lands
    ap6-NODEFS        append lines containing no definitions    lands           lands
    ap7-DECLARED      append a duplicate with DUPLICATE: foo    lands           lands
    am2-METHOD-NEW    append a genuinely NEW method to a class  lands           lands

    BASELINE   6 of 9 correct - the three duplication cases land the corruption
    FIXED      9 of 9 correct

The six legitimate cases are the point. A fix that refused everything would satisfy the three positive
cases and be worthless; sensitivity and specificity are orthogonal. In particular `ap4-NEWFILE` guards
the obvious way to break this change — a file that does not exist yet still leaves `beforeSrc` null
through the existing `catch`, so creating a file by append is unaffected — and `ap7-DECLARED` proves
the refusal still has an exit, so it cannot become a loop.

`rm=0` on every append row, before and after. The removal refusal stayed vacuous on this route exactly
as the comment predicts; it did not start firing falsely.

### am1-METHOD-DUP IS THE REAL SHAPE, NOT A SYNTHETIC ONE

Set H recorded `append_file` x22 on `s8_grades.py` ending with `set_weight` x20 — an **indented**
Python method, the shape column-0 `duplicateDecls` can never see and `defCounts` was built for. The
top-level controls do not cover it, so it is covered separately. Python's own `ast` confirms the
appended text lands inside the class:

    class Gradebook methods: ['__init__', 'set_weight', 'set_weight']

Baseline lands that. The fix refuses it. This is the observed corruption, not an analogue of it.

## EXISTING TESTS

Eight directly relevant suites on the fixed tree, 50 assertions, 0 failures:

    appendFile 5   appendFragment 7   appendSyntax 4   defLoss 6
    destructiveWrite 8   duplicateDecls 9   exportLoss 7   noopEdit 4

Broad sweep of all remaining suites: **77 passed, 3 non-zero, 10 skipped** (network/model/Godot
suites skipped). All three non-zero results were then run on BOTH trees, swapping `agent.js` in place
so trunk was never touched:

    suite            sweep result                        FIXED tree        BASELINE c952cbc
    ──────────────────────────────────────────────────────────────────────────────────────────
    batchActions     rc=124, last line `ok`              rc=124, same line  rc=124, SAME LINE
    supervisorTick   rc=124, last line `ok`              rc=124             rc=124
    verifierInfra    rc=1, "2 passed (with failures)"    3 passed, rc=0     3 passed, rc=0

`batchActions` and `supervisorTick` are **slow, not broken** — both exceed the sweep's 90s cap on the
unmodified tree with identical output, and neither test contains a single reference to `append_file` or
`beforeSrc`, so the changed code path is unreachable from them.

`verifierInfra` was the only real assertion failure, and it does **not reproduce**: given 180s and no
concurrent load it reports `3 passed` on both trees. It drives a headless browser against a
deliberately unreachable `.invalid` domain, which is plausibly why it is sensitive to load. Stated
precisely, because a flaky test cannot be fully exonerated: **it passes in isolation on both trees and
references neither changed symbol.** That is weaker than "it is unrelated", and it is what was
observed.

So no regression is attributable to this change, on 80 suites. That is the claim, and it is not the
same as "the suite is green" — three suites need more than 90s or an unloaded machine to say so.

## WHAT IS NOT ESTABLISHED

- **Appending syntactically broken content.** Every legitimate control appends valid code. If an
  append leaves the file unparseable, `defNames` may see earlier definitions as absent and the now-
  reachable REMOVAL refusal could fire where it previously could not. Untested. It would refuse an
  append that broke the file, which is plausibly desirable, but it is a behaviour change beyond the
  demonstrated defect and it is not claimed as verified.
- **That this changes any score.** This closes a corruption route. Whether preventing it improves
  completion is a different question with a different experiment, and set G's own history warns
  against assuming it does: twenty fixes stopped destruction without raising the score.
- **The other two uncovered routes.** `spawn_subtask` (`agent.js:2690`) and the human-approval resume
  (`agent.js:4590`) still execute writes with no preservation machinery. Neither was exercised by any
  model in 17,466 recorded replies, so closing them is prophylaxis rather than a measured fix, and
  they are deliberately left alone here.

## REPRODUCING

    node <hub>/measurements/replay/replay-run.mjs benchmarks-append-route/append-suite.jsonl --all \
         --hub <worktree>/server/index.js --out out.jsonl --keep
    node benchmarks-append-route/score-append.mjs out.jsonl

The scorer prints PASS/FAIL per control against the post-fix expectation, so it reads 6/9 on an
unfixed tree and 9/9 on a fixed one. It is a regression that can fail in both directions: if
`ap1-DUP-PY` stops refusing the route has regressed, and if `ap4-NEWFILE` starts refusing the fix has
over-reached.

**Note on the rig itself:** `replay-run.mjs` as shipped detects refusals by regex over the prompts
served to the model, and the duplicate refusal's message is too long to survive into prompt text — it
reads 0 while the refusal actually fired. These controls are scored from run **steps** and from disk
instead. That is a defect in the measuring instrument, not in the hub, and it is the single thing most
likely to stop another developer from using this rig unaided.
