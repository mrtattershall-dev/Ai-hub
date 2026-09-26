# NARROW-1 RESULT — narrowing the output responsibility converted the failure from "no candidate" to "an executable candidate that fails one named behaviour"

2026-09-26, 09:25–09:31Z, **$0** (local ollama, qwen2.5-coder:1.5b, i3-1315U / 7.6 GB, no GPU).
Definition frozen at c68b890; nothing in the play, the evaluator or the acceptance policy was
touched. Five seeded attempts at farm-i1 (movement + the state contract; requested steps 1-3;
nothing protected).

## Where the failure sits now

    boundary                              1.5B broad protocol (M1-LIVE-1/2)   1.5B narrow protocol
    B1 artifact produced                  0 of 2 runs                          5 of 5
    B2 artifact complete (natural stop)   0 of 2                               5 of 5
    B3 contract clean (nothing outside)   n/a                                  5 of 5
    B4 reached execution                  0 of 2                               5 of 5
    B5 passed diagnostic                  0 of 2                               0 of 5
    B6 passed protected                   n/a (nothing protected)              5 of 5
    B7 accepted                           0 of 2                               0 of 5

    termination        stop 5 / 5 - every attempt ended NATURALLY. No token ceiling, no
                       deadline abort, no truncation.
    disposition        PRESERVE_INCOMPLETE 5 / 5 (a candidate was kept and judged; nothing
                       was promoted, nothing was destroyed)

**The failure moved five boundaries.** Under the broad protocol the model never produced a
usable artifact at all: 836 s of unbounded generation in one run, and three echoes of the
guidance text in the other. Under the narrow contract it produced a complete, contract-clean
HTML file every time, in 50–62 s, and the unchanged verifier executed all five.

## Why all five failed B5, named exactly

**The request did name the seam.** The state contract carried in every attempt says, in
prose: *"The page must expose window.game.state() returning { player: {x, y}, tiles: ...,
inventory: ..., day }."* So this is not a case of the model never being told. It was told, in
prose, and did not build it.

Every one of the five built the game's substance — a canvas with `getContext`, a `keydown`
handler in 4 of 5, `player`, `tiles`, `inventory`, `day` as real variables, and
`localStorage` save/load — and **none implemented the observability seam the request
described**. A callable `state()` was absent in 5 of 5; `window.game` appeared in 2 of 5 but
without a state function. So the play's first step could observe nothing:

    FAIL case 1  loads with no page or console errors and exposes state
                 -> expected ... state && state.player ...; state null
    ERROR case 2 ArrowRight moves the player right: Cannot read properties of null

The consequence is important and must not be overstated: **the play could not observe whether
movement works, so nothing here says the movement code is correct.** What it says is that the
candidate is executable and fails at one identified interface, not at "the model cannot
implement increment 1".

## The prompt, not the emission rate, was the speed limit

    prompt tokens   output tokens   generation   output tokens/s
    366             725-876         50-62 s      13.8 - 14.6

**Two configurations, two throughputs — reported as that, not as a cause.**

    configuration                     prompt tokens   output tokens/s
    agent loop (M1-LIVE-2)            15,290          2.3
    narrow artifact harness           366             13.8 - 14.6

CORRECTED after review: the two configurations differ in more than prompt length — the system
prompt, the message structure, the sampling call and whether tools are described all change
together — so **this does not isolate prompt length as the cause.** Isolating it would need the
same harness at several prompt sizes with everything else fixed, which has not been done. What
the pair does establish is narrower and still useful: **in the configuration that produced
complete artifacts, a complete increment-1 file is about one minute of generation**, so
wall-clock truncation was not the binding constraint here, whatever drives the difference.

## Reading, against what was pre-registered

The frozen reading was: *"The protocol was the problem if attempts now reliably reach B2 —
whether or not they pass B5. Emitting complete files and failing behaviourally is the outcome
that proves the earlier failure was substantially interface, not capability."*

That outcome occurred, 5 of 5, with natural termination in every attempt. **Restricting the
1.5B's output responsibility converted an interface/protocol failure into an executable
candidate, with the verifier and the acceptance standard unchanged.** This is direct support
for the standing finding that apparent model capability depends heavily on how much
responsibility sits at a single generation boundary.

NOT established: that the model can pass increment 1 (0 of 5 did); that its movement or
planting logic is correct (unobservable through a missing seam); anything about later
increments; anything about the 7B.

**And one reading the frozen definition allowed that must be weakened** (corrected after
review): the definition said continued failure to reach B2 would indicate "a capability or
inference-performance limit". Continued failure would **not prove a capability ceiling** —
other interface, sampling or implementation problems could remain unexamined. It would raise
that as one live possibility, no more.

## What this makes the next question

The remaining failure is a single interface the request described in prose and the model did
not build. Two readings, and one free experiment separates them:

- prose naming an interface is not enough for a 1.5B, but a verbatim line with a placement
  is -> NARROW-2 should move B5 above zero
- it cannot build a seam over its own state at all -> NARROW-2 changes nothing, and the
  remaining gap is capability, not instruction form

NARROW-2 (frozen separately, $0) adds the verbatim line and where to put it - the contract
already named the interface in prose - and changes nothing else. The seam is a declared interface, like a function signature; the
behaviour under test (movement changes x, planting spends a seed) stays entirely the model's
work and the play is untouched.

Records: `NARROW-1_seed1..5.json` (verbatim replies, extraction, play logs, verdicts, timings),
`NARROW-1_run.log`, `NARROW-1_gate.log`. Instrument: `server/narrowArtifact.mjs`, proven able
to fail at every boundary by `server/narrowArtifact.test.mjs` 27/27.
