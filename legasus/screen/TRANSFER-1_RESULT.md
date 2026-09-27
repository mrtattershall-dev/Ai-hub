# TRANSFER-1 — the guidance transferred; the addition did not. Site selection and containment both worked on a page I had not read. Zero accepted, and the cause is one word in the page: `const`.

2026-09-27, **$0**, local. Policy frozen and committed at `36cc118`; **the page was written after that
commit**, so the commit order is the evidence that no rule was adapted to it. Guidance-rule source
hashes recorded before and after the only two code changes, both plumbing, both byte-identical in the
parts that decide anything.

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
    regressions              0
    accepted                 0
    generation               44.1 s, 268 output tokens
    interventions by me      0

    every attempt            play [1,2,3,4] - the page's own behaviour preserved - failing 5,6,7,8
    disposition              PRESERVE_INCOMPLETE, five times

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
structure — and neither rule reads declarations.** That is the gap this transfer exposed.

## What transferred and what did not

    TRANSFERRED   site selection - the other rule fired, on a shape it was not authored against, with a
                  stated reason
    TRANSFERRED   the scaffold rules - a minimal branch, no tile-key line, no redraw invented (the page
                  has drawPanel, not draw, and the rule requires every existing handler to call the same
                  zero-argument redraw; it correctly supplied none, and the model added drawPanel itself)
    TRANSFERRED   structural containment - 5 of 5 completions truncated exactly right, 0 refusals,
                  0 regressions, the page's own behaviour preserved every time
    DID NOT        the addition. 0 of 5 accepted, all for one reason the guidance cannot currently see.

## The protocol's consequence, and I am following it

The rule I froze was: **if it fails and I tune, that result is preserved and the revision is tested on
another untouched page.** So this record stands as it is. The obvious revision — have the scaffold or the
instruction report how the state it must change is declared, so a `const` binding is visible — is **not
applied here**, and when it is, it must be tested on a third page that neither version has seen.

**This is also a candidate signature for the diagnosis engine**, which currently has no entry for
`Assignment to constant variable`. It would be a clean addition: the observation is the declaration, and
the discriminating fact is whether the binding is `const`.

## What this establishes

- **Established:** the guidance rules transfer to a page whose structure I had not read, in the sense
  that they choose a different and correct site, produce a minimal scaffold, and contain the model's
  output exactly. That is the part that was in doubt.
- **Established:** the page's existing behaviour was preserved in all five attempts, and nothing was
  accepted, so the gate did not let a broken change through.
- **NOT established:** that the system can complete an addition on an unfamiliar page. It did not.
- **NOT established:** anything about a third page, another language, or a requirement shape other than
  "one key triggers an effect".

Records: `TRANSFER-1_DEFINITION.md`, `TRANSFER-1_MANIFEST.txt` (hashes, committed before the page
existed), `TRANSFER-1_run.json` (raw completion and extracted candidate per attempt),
`legasus/bench/panel/baseline-as-delivered.html`, `legasus/bench/panel/play-panel.json`,
`TRANSFER-1_gate.log`.
