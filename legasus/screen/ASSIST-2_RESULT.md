# ASSIST-2 — the system chose the guidance itself and reached an accepted addition with ZERO interventions. It also let through a regression, because the boundary failed and my protected set was too narrow.

2026-09-27, **$0**, local, nothing deployed. Policy frozen in `ASSIST-2_DEFINITION.md` before it was
written; fresh task `farm-grow`, whose checks were validated against mutants before anything saw them.

## What the system decided, with no input from me

    site        R2 - "no existing keydown listener dispatches on key values, so a new listener goes
                after the last one". Chosen by reading the file, not told.
    scaffold    document.addEventListener('keydown', (e) => {
                    if (e.key !== 't') return;
                    // FILL IN
                    try { draw(); } catch (err) { /* redraw is not the change */ }
                });
                and it declined to supply a tile-key line, because the requirement's effects name
                "every planted tile" and not the player's own - the opposite of what ASSIST-1 needed
    instruction // on this key: day goes up by one; every planted tile's stage goes up by one,
                stopping at 3. Ensure no tile is created or removed.
                (131 characters, built from the requirement's own words)

**Then the model filled the slot and it was accepted on the second seed.**

    attempts                2 (seed 1 threw at load, seed 2 accepted)
    site choices            1
    generation              125.7 s
    output tokens           1,114
    INTERVENTIONS BY ME     0

    ASSIST-1, me guiding    15 attempts, 3 accepted, 766 s, 7 interventions
    ASSIST-2, the system     2 attempts, 1 accepted, 126 s, 0 interventions

## Independently verified — and then the verification found the problem

    playCheck, the grow spec        OK, passing [1,2,3,4,5,6], errors 0
    the automatic diagnostic        OK, 6/6
    the independent evaluator       requested PASS, protected PASS
    the PLANTING spec, strict       passing [1,2,3,4,5,7], FAILING [6]

**The last line is a regression.** The page before this run passed all seven planting checks. The page
after it fails step 6 — "with the seeds exhausted, p changes nothing". The growth task's own protected
set did not catch it.

    before   2 keydown listeners, 0 stray 't' bindings, 4,092 chars, planting-v2 7 of 7
    after   24 keydown listeners, 4 stray 't' bindings, 8,083 chars, planting-v2 6 of 7

## What actually went wrong, and whose fault each part is

**1. The output boundary failed to contain the completion — infrastructure, mine.** The trim cuts at the
first line of the suffix, and the suffix's first line was
`try { draw(); } catch (err) { … }`. The model wrote plain `draw();`, so nothing matched and it ran on
for another 4,000 characters: it wrote the correct growth code, then invented handlers for `h`, `s`,
`l`, `a`, `p` and `t` again, binding some of them to the file's own functions. **The accepted page has
24 keydown listeners where it should have 3, and four separate bindings for `t`.** One of those binds
`t` to `harvestCrop`, which happens to be inert only because its guard looks for a crop named `seed`
while planting now writes `wheat`. That is a landmine for the next increment.

**2. The protected set was too narrow — task definition, mine.** I gave `farm-grow` a protected set of
three steps: load, movement, and one planting action. The behaviour that broke — planting stopping when
seeds run out — was accepted work, and it was not in that set. **The increment principle I already use
elsewhere is that the protected set is the union of every previously accepted check, and I did not
apply it here.** The gate behaved exactly as instructed; the instruction was wrong.

**3. The policy's own three decisions were sound** — the site, the scaffold and the instruction, including
the judgement call to supply no tile-key line because this requirement is about every tile rather than
the player's, which is the opposite of what the previous task needed.

CORRECTED after review: I first wrote that "neither of these is the policy's fault", which draws the
boundary too narrowly. **The output limit and the choice of protected checks are parts of the system
being evaluated**, not context around it. Attributing the failure away from "the policy" while the
system as a whole accepted a regression is the same move as calling a harness defect a model limit.
**The system failed here.** Which component failed is useful for fixing it and is not a defence.

## So what does this establish

- **The milestone's condition held: zero interventions.** The system chose the scope, wrote the
  scaffold, wrote the instruction, and working growth logic came out, verified through three paths with
  no errors.
- **The 2-against-15 comparison is NOT an efficiency result** (corrected after review): the tasks differ
  and this run inherited the preparation ASSIST-1 paid for. The two are not comparable on effort.
- **The task was fresh; the page informed the rules** (corrected after review). R2 fired because I had
  read this page when writing the rule. This is automatic application on that page, not independent
  generalisation.
- **But the result is not a clean pass**, because the accepted page carries a regression and a heap of
  junk. **An acceptance gate that only checks the behaviours it was given will accept an incoherent
  change**, and this one did.
- **What it does NOT establish:** that the policy generalises. One task, one page, rules I wrote while
  looking at that page. The declined tile-key line is evidence the rules are not a single hardcoded
  path; it is not evidence they transfer.

## The two fixes, which are interventions and therefore belong to the NEXT run

    F1  the protected set must be the UNION of every previously accepted check, computed rather than
        chosen. farm-grow should have protected all seven planting checks.
    F2  the boundary must not depend on the model reproducing a particular line. Cut when the brace
        depth returns to the level at the hole, or when any line of the completion appears verbatim in
        the first few lines of the suffix, or cap the insertion at a small multiple of the slot's size.

Both are mechanical and task-independent, so both are infrastructure rather than judgement — which is
the same distinction ASSIST-1 drew. **They are recorded here and not applied to this result.**

Records: `ASSIST-2_DEFINITION.md`, `ASSIST-2_run.json`, `ASSIST-2_accepted_index.html`,
`ASSIST-2_gate.log`, `server/autoGuide.mjs`, `legasus/bench/farm/play-grow.json`,
`server/farmGrowSpec.test.mjs` (11/11).
