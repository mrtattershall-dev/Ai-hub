# NARROW-2 RESULT — stating the interface verbatim moved the failure from "unobservable" to "observed behaviour", and produced the first increment from the local 1.5B to PASS SPEC v1

> **AMENDED 2026-09-27 — the acceptance stands as "passed spec v1", and a defect found later is
> attached to it.** This result is unchanged as a record of what the gate said. What changed is what
> that verdict covers: the accepted page **throws five times during the arrow-key movement it was
> accepted FOR**, and the check could not see it. Read the acceptance as **"passed farm-i1 under play
> spec v1"**, never as "error-free" or "fully working". Details in the amendment at the foot of this
> file and in `REPAIR-1_RESULT.md`.

2026-09-26, **$0** (local ollama, qwen2.5-coder:1.5b, same laptop). Five seeded attempts at
farm-i1, **the play, the evaluator and the acceptance policy byte-identical to NARROW-1** —
the only difference between the cells is the request. Verified by a test cell that captures
both prompts: v1 names `window.game.state()` in prose; v2 adds the line verbatim plus where to
put it, and nothing else differs (`narrowArtifact.test.mjs`, cell 6).

## The two cells, same model, same seeds, same gate

    boundary                  v1: seam named in prose   v2: seam given verbatim
    B1 artifact produced              5 / 5                    5 / 5
    B2 complete, natural stop         5 / 5                    5 / 5
    B3 contract clean                 5 / 5                    5 / 5
    B4 reached execution              5 / 5                    5 / 5
    B5 passed diagnostic              0 / 5                    1 / 5
    B6 passed protected               5 / 5                    5 / 5
    B7 accepted (RETAIN)              0 / 5                    1 / 5

    seam actually built         full 0/5, partial 2/5,     full 4/5, none 1/5
                                none 3/5
    state observable at all     0 / 5                      3 / 5  (steps 1 passed)
    termination                 stop 5/5                   stop 5/5
    generation                  50-62 s, 725-876 tok       42-63 s, 621-901 tok

    per seed (v2)   1: no seam, play []         PRESERVE_INCOMPLETE
                    2: full seam, play [1,2,3]  RETAIN          <- accepted
                    3: full seam, play []       PRESERVE_INCOMPLETE
                    4: full seam, play [1]      PRESERVE_INCOMPLETE
                    5: full seam, play [1]      PRESERVE_INCOMPLETE

## What moved, in order of how strongly the evidence supports it

1. **The seam itself: 0 of 5 built it correctly from prose, 4 of 5 from the verbatim line.**
   This is the large, mechanistically direct effect, and it is about instruction FORM: the
   same interface, named in prose versus given as a line with a placement.
2. **Observability: 0 of 5 versus 3 of 5.** Three v2 attempts exposed state well enough for
   the play to judge behaviour at all.
3. **Acceptance: 0 of 5 versus 1 of 5.** **1 of 5 is the observed count in this sample, not a
   dependable rate** — five attempts cannot estimate performance, and it must never be quoted
   as "20%". What it establishes is existence: one local 1.5B-produced increment passed an
   unchanged independent gate.

**The residual failure is now the useful kind.** In v1 nothing could be observed, so nothing
could be said about the game. In v2 two attempts (seeds 4, 5) exposed state and failed
movement — a behaviour failure the diagnostic can describe case by case and a recovery loop
can act on. The failure class changed from "unverifiable" to "verifiably wrong".

## What the verbatim seam gives the model, stated plainly

The v2 request carries the seam as a line to include:
`window.game = { state: () => JSON.parse(JSON.stringify(STATE)) };` — **that is implementation
help, not only a specification.** It supplies the exact expression; the model's remaining work
is to have a state object worth exposing and to wire the behaviour. Recorded here because it
bears on what the model is credited with: the movement, planting and save logic are its work,
the one-line observability seam is not. Handing an implementer a declared interface is
reasonable product engineering, but it must stay visible when reading "the model built
increment 1".

## The accepted artifact, re-verified independently

    seam as emitted   window.game = { state: () => JSON.parse(JSON.stringify({ player, tiles, inventory, day })) };
    its own 3 steps   PASS 1,2,3          (re-run outside the harness that accepted it)
    the full 8 steps  PASS 1,2,3  FAIL 4,5,6,7,8   (correct for an increment-1 artifact:
                      planting, growth, harvest and saving are later increments)

## A defect in my own verifier, found by that re-verification

The first independent re-run of the accepted page failed all three steps. The cause was not
the page and not model non-determinism: **`playCheck`'s static server joined the request path
(normalising to Windows backslashes) and compared it against the caller's raw directory
string, so a forward-slash directory failed the containment guard and 404'd every request** —
and a 404 on the entry page was reported as failing STEPS rather than as an apparatus failure.
A caller passing a forward-slash path would have had generated code blamed for the harness's
own inability to serve it.

    fixed   the served directory is resolved, and both sides of the containment guard compare
            resolved paths
    fixed   an entry page that cannot be served (4xx/5xx) is UNAVAILABLE with the status named,
            never a verdict on the candidate
    tested  playCheck.test 19/19, with a forward-slash directory serving 8/8 and a missing
            entry page returning UNAVAILABLE

**Scope: no earlier result is affected.** Every prior caller passed a directory from
`mkdtempSync` or `path.join(fileURLToPath(...))`, which are backslash paths on this machine, so
the guard held. Checked directly: none of the ten stored NARROW records contains a 404 on the
entry page, and per-step outcomes vary across them (passing [1,2,3], [1], []) which is
impossible if the page had never loaded.

## Reading, against what was frozen

The pre-registered readings were *"prose naming an interface is not enough for a 1.5B, but a
verbatim line with a placement is -> NARROW-2 should move B5 above zero"* and *"it cannot build
a seam over its own state at all -> NARROW-2 changes nothing"*. **The first occurred.** B5 moved
from 0 to 1, the seam from 0 to 4 of 5, and observability from 0 to 3 of 5.

Taken with NARROW-1, the whole progression on one model, one task and one unchanged gate:

    broad agent-loop protocol   no artifact at all              (0 of 2 runs)
    narrow artifact, prose seam complete artifact, unobservable (5 of 5 / 0 of 5)
    narrow artifact, given seam complete artifact, observable,  (5 of 5 / 3 of 5 / 1 of 5)
                                one accepted

**In these three configurations, what the model produced depended heavily on how much
responsibility sat at one generation boundary and on the FORM in which an interface requirement
was stated** — one model, one task, one unchanged gate, $0. Stated as a pattern across three
cells rather than a law: each pair of cells differs in more than one respect (see the
throughput note in NARROW-1_RESULT), and the acceptance counts are small.

NOT established: a pass rate (1 of 5); that the model can do increments 2-4; that a chain of
four would hold; anything about the 7B. The 7B cells are AUTHORIZED at a $3 cap but HELD and
not launched ($0 spent on them) - see NARROW-1_DEFINITION.md.

## Closing checks after the verifier fix (all $0)

    the accepted artifact through every invocation path   playCheck direct [1,2,3];
                                                          automatic diagnostic 3/3;
                                                          independent evaluator requested PASS
                                                          -> all three AGREE
    all ten stored artifacts re-judged, corrected verifier 10 of 10 UNCHANGED; 0 classification
                                                          changes

`server/recheckArtifacts.mjs`, output in `NARROW_RECHECK.json`. The fix changed no earlier
classification, and the one acceptance holds through every path that can judge it.

Records: `NARROW-2_seed1..5.json`, `NARROW-2_run.log`, `NARROW-2_gate.log`,
`NARROW-2_accepted_index.html` (the accepted artifact), `NARROW_RECHECK.json`.

---

## AMENDMENT, 2026-09-27: what the acceptance did and did not cover

**The verdict stands. Its scope was narrower than the wording suggested.**

    what was established   the artifact passed farm-i1 under play spec v1: it loads, exposes the
                           declared state seam, and the player moves on arrow keys. Three
                           independent invocation paths agreed.
    what was NOT           that the page is error-free while doing it. Reproduced on the untouched
                           artifact (`server/baselineValidity.mjs`): it raises FIVE
                           `Cannot set properties of null (setting 'textContent')` errors during
                           farm-i1's own required movement. `draw()` ends with
                           `document.getElementById('day').textContent` and no such element exists.
    why the gate missed it play spec v1's error check is step 1, and step 1 is evaluated BEFORE any
                           key is pressed. The errors are caused by the movement the later steps
                           perform, so no assertion was ever in a position to see them.

**This is a test-coverage gap in the check, not a retraction of the result.** The corrected check is
versioned rather than edited in place, so every earlier number remains interpretable:

    play spec v1 / farm-plant      6 steps, UNCHANGED - what this artifact was measured against
    farm-plant-v2                  7 steps: the same, plus "no page or console error was raised at
                                   any point". THIS ARTIFACT FAILS IT.

`farmPlantV2Spec.test` 10/10 pins the new version: the accepted artifact fails the new step; a
correct planting handler alone still fails it, so it is not a planting check in disguise; and
supplying the missing `#day` element as well passes all seven, so it is satisfiable.

**How to describe this artifact from now on:** the first increment from the local 1.5B to pass spec
v1, carrying a known defect that spec v1 could not see. Any later result that reuses it as a baseline
inherits that defect, and any successor that makes the keys work inherits its errors.
