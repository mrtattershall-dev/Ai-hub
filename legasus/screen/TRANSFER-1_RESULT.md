# TRANSFER-1 — the guidance transferred; the addition did not. Site selection and containment both worked on a page I had not read. Zero accepted, and the cause is one word in the page: `const`.

2026-09-27, **$0**, local. Policy frozen and committed at `36cc118`; **the page was written after that
commit**, so the commit order is the evidence that no rule was adapted to it.

**THE EXECUTED VERSION'S PROVENANCE.** Unchanged rule hashes show those rules were preserved; they do not
mean the code that ran is the code in the manifest. Two files differ from the frozen manifest, and both
changes belong in this record rather than in a footnote:

    server/autoGuide.mjs    the task lookup was widened beyond farm tasks. The guidance functions'
                            source hash is identical before and after
                            (b65885c20bac8932c841deb388ad1593772930d7f56e0cc2ffaaeb686eda950f).
    server/localEdit.mjs    it resolved its task AT IMPORT TIME and called process.exit when the id was
                            unknown, which killed any run whose task lived in another group. The exit is
                            now confined to the case where that file is the program being run. The
                            containment source hash is identical before and after
                            (986c67a5465aa6765c7550f39ffb4970...).

So: the RULES that chose the site and contained the output are provably the frozen ones; the PROGRAM that
ran them is two plumbing commits later, and `TRANSFER-1_EXECUTED_MANIFEST.txt` records the hashes of what
actually executed.

## The page, and why it is a real test

The local 1.5B wrote it from a one-line request: a light-switch panel, three lamps on a canvas, keys 1-3
toggling them. **Its structure differs from the farm page in exactly the way that matters:**

    the farm page    one keydown listener beginning `if (e.key !== 'p') return;`   -> rule R2 fired
    the panel page   one keydown listener dispatching `if (e.key === '1') ...`     -> rule R1 fired

**The site rules met a shape they were not authored against and chose the other branch**, for the stated
reason: *"a keydown listener already dispatches on key values and does not exclude this key, so a branch
goes inside it."* The scaffold it wrote was three lines:

    if (e.key === '0') {
        // FILL IN
    }

and the instruction was built from the requirement alone: *"// on this key: every lamp is off. Ensure no
lamp is ever turned on by this key."*

## The result

    attempts                 5
    site choices             1 (R1, first try)
    refusals                 0 - every completion was containable
    accepted                 0
    generation               44.1 s, 268 output tokens
    interventions by me      0

    every attempt            play [1,2,3,4] - failing 5,6,7,8
    disposition              PRESERVE_INCOMPLETE, five times

**"Zero regressions" needs its boundary stated, so here are the three separate facts it was standing
for:**

    the carried-forward checks PASSED      the protected sequence verdict was PASS in all five
                                           attempts: load, the three existing toggles, and no errors
                                           during THOSE steps
    the candidates DID throw               2 captured errors per attempt, both
                                           `Assignment to constant variable`, raised when the NEW key
                                           was pressed. A candidate that throws on its own new action is
                                           not a candidate that preserved everything - it is one whose
                                           damage falls outside what the carried-forward checks exercise
    the baseline file is untouched         each attempt ran in a fresh copy; the stored baseline's
                                           sha256 is byte-identical after the run
                                           (f9c49c2a8dd58599). No attempt was RESTORED, because none
                                           failed the protected set - so nothing needed rolling back,
                                           which is a different statement from "nothing broke".

## Containment transferred perfectly

Each raw completion ran past the slot, and each was truncated at the structural escape point, keeping
**exactly the two lines that matter**:

    RAW (6 lines)          LAMPS = [false, false, false];
                           drawPanel();
                           }
                           if (e.key === '2') {
                           LAMPS = [true, true, true];
                           drawPanel();
    EXTRACTED (2 lines)    LAMPS = [false, false, false];
                           drawPanel();

Both versions are stored for every attempt. **The system's contribution here was dropping 3 to 5 lines
of a second, invented handler that would have bound key 2 to turning all lamps ON** — the exact opposite
of the requirement.

## Why it still failed, precisely

    [JS ERROR] Assignment to constant variable.

The page declares `const LAMPS = [false, false, false];`. The model's two lines are correct in intent and
illegal in this page: they **reassign** the binding instead of mutating the array. Pressing 0 throws
inside the handler, the lamps keep their values, and step 5 fails with the state still `[false,true,true]`.

A person would have written `LAMPS.fill(false)`. **Nothing in the guidance told the model the binding was
`const`, because the instruction is built from the requirement's words and the scaffold from the file's
structure — and neither rule reads declarations.**

**This is the OBSERVED blocker, not established as the whole cause of non-completion.** It is the first
thing that fails, and removing it may simply reveal the next one: the completion would still have to
mutate the array correctly, leave the existing toggles working, and stop at the slot. Five attempts all
stopped at the same point, which says that point is reached reliably — not that it is the only point.

**And the explanation for why it failed is itself unproven.** The declaration `const LAMPS` was in the
file the model was given; it had the fact and did not respect it. So "the guidance should surface the
declaration" is a plausible next improvement, not a demonstrated missing ingredient. Feeding the runtime
error back is an equally plausible route, and neither has been tested. What is established is the
failure and its immediate mechanism.

## What transferred and what did not

    TRANSFERRED   site selection - the other rule fired, on a shape it was not authored against, with a
                  stated reason
    TRANSFERRED   the scaffold rules - a minimal branch, no tile-key line, no redraw invented (the page
                  has drawPanel, not draw, and the rule requires every existing handler to call the same
                  zero-argument redraw; it correctly supplied none, and the model added drawPanel itself)
    TRANSFERRED   structural containment - 5 of 5 completions truncated exactly right, 0 refusals, the
                  carried-forward checks passing every time and the baseline file untouched
    DID NOT        the addition. 0 of 5 accepted, every attempt stopping at the same observed blocker.

## The protocol's consequence, and I am following it

The rule I froze was: **if it fails and I tune, that result is preserved and the revision is tested on
another untouched page.** So this record stands as it is. The obvious revision — have the scaffold or the
instruction report how the state it must change is declared, so a `const` binding is visible — is **not
applied here**, and when it is, it must be tested on a third page that neither version has seen.

**This is also a candidate signature for the diagnosis engine**, which currently has no entry for
`Assignment to constant variable`. It would be a clean addition: the observation is the declaration, and
the discriminating fact is whether the binding is `const`. Whether surfacing that fact changes what the
model writes is the open question, not a conclusion.

## What this establishes

- **Established:** the guidance rules transfer to a page whose structure I had not read, in the sense
  that they choose a different and correct site, produce a minimal scaffold, and contain the model's
  output exactly. That is the part that was in doubt.
- **Established:** the carried-forward checks passed in all five attempts, the baseline file is
  byte-identical after the run, and nothing was accepted — so the gate let no broken change through.
  **The candidates did throw on their own new action**, which is why "preserved everything" is not the
  claim.
- **NOT established:** that the system can complete an addition on an unfamiliar page. It did not.
- **NOT established:** anything about a third page, another language, or a requirement shape other than
  "one key triggers an effect".

Records: `TRANSFER-1_DEFINITION.md`, `TRANSFER-1_MANIFEST.txt` (hashes, committed before the page
existed), `TRANSFER-1_run.json` (raw completion and extracted candidate per attempt),
`legasus/bench/panel/baseline-as-delivered.html`, `legasus/bench/panel/play-panel.json`,
`TRANSFER-1_gate.log`.
