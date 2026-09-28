# ASSISTED-1 — **ONE VERIFIED SUCCESS on a page the rules were not written against.** 5 calls, 8 interventions, $0.

2026-09-27, local, `qwen2.5-coder:1.5b`. Definition frozen at `19d2cfd` before the pages existed.
Budget was 20 attempt calls and 12 interventions; **5 calls and 8 interventions were used.**

**One successful solution establishes ATTAINABILITY, not a performance ceiling.** What it buys is a
concrete target: the eight interventions below are the list of things automated guidance would have to
produce by itself.

## The success

    accepted            attempt 5, seed 1
    the addition        pressing r sets the light straight to red, whatever colour it is showing
    what the model      state.color = lightColors.red;
    actually wrote      drawLight();
    requested checks    9 of 9 PASS
    carried-forward     PASS - the page's own cycling behaviour, unchanged
    errors              0
    evaluator           PASS on named tree 100f3dacc57a5beaae5c15cb297a6da89140491d
    disposition         RETAIN
    re-verified         REPRODUCIBLE EXECUTION, demonstrated: rebuilt from the ledger, sha
                        13d0b08c86628a99 MATCHES the judged candidate, then re-run in a fresh process
                        and a fresh browser - 9 of 9 again. This shows the SAVED ARTEFACT behaves the
                        same way when run again.
                        REPRODUCIBLE GENERATION, untested: nothing here shows that running the same
                        prompt again would produce that candidate again. One seed, one draw. The two
                        are different claims and only the first is demonstrated.

The system's own contribution is visible and was large: the raw completion was **26 lines**, inventing
further listeners and repeating the context comments back; containment kept **2 lines** and dropped 24.

## The page, and how it came to be a valid baseline

**Page A as first delivered was NOT a baseline, and the experiment did not start on it.** Measured, not
assumed: it loaded with 0 errors but had no `window.app` seam at all, so its state was unreadable and 4
of 5 steps failed with `Cannot read properties of undefined`. The frozen definition says a page failing
any baseline requirement is not a baseline, so it was regenerated with the seam stated as a hard
requirement - page generation does not count against the attempt budget, and every request text and hash
is in `legasus/bench/traffic/GENERATION-LOG.txt`.

**Page A2 (`baseline-a2.html`, sha `9ae3cb01e221b98a`) satisfied all four requirements:**

    loads clean                   0 errors
    full sequence PASSES          steps 1-4 and 9, from a fresh load
    the addition is ABSENT        steps 6 and 7 FAIL, and for the right reason: pressing r does
                                  nothing, so the colour stays where the cycle left it. The harness is
                                  not broken - step 9 passes on the baseline.
    sha recorded                  yes

**A note on what the page actually does, which is not what I asked for.** The one-line request asked for
keys 1, 2 and 3 to select red, amber and green. The model wrote all three keys calling the same
`switchLight()`, which **cycles** red -> yellow -> green -> red. The checks describe what the page does,
measured, rather than what was requested - the page is the artefact.

## THE INTERVENTION LEDGER — the eight things I supplied, in the order they were needed

    #  attempt  what I supplied                                          what it changed
    1  1        LOCATION: the anchor line, inside the existing listener  -
    2  1        SCAFFOLD: an `if (e.key === 'r') { ... }` block          -
    3  1        INSTRUCTION: "// on this key: the light is red. Ensure
                the cycling keys keep working."
       ->       REFUSED, EMPTY. The model produced no code at all: it read the instruction comment as a
                TEMPLATE and generated a chain of `} else if (e.key === 'a') {` branches each with its
                own comment line. Comment begets comment.
    4  2        the instruction INDENTED to match the slot               nothing. Same failure, and it
                                                                         ran to the 400-token cap
                                                                         producing a longer chain.
    5  3        LOCATION: a new anchor, AFTER the existing listener
    6  3        SCAFFOLD: a NEW listener with an EARLY RETURN -
                `if (e.key !== 'r') return;` - instead of an if-block
       ->       THIS IS THE ONE THAT MATTERED. Output changed from comments to CODE immediately. The
                model wrote `switchLight();` - a statement. Containment kept that 1 line and dropped 53.
                8 of 9 steps passed; only step 6 failed, because switchLight ADVANCES rather than sets.
    7  4        CONTEXT, taken mechanically from codeFacts (compact,     the output became TIDY - 5
                budget 240): that `state` is declared `let` at line 25,   tokens, exactly one line, no
                that existing code writes it as `state.color =            runaway - but still
                colors[index % colors.length]` at line 38, and that       `switchLight();`. Same single
                switchLight() takes no arguments                          failing step.
    8  5        FEEDBACK: the failing step and what the last candidate    SUCCESS. The model wrote
                did wrong - "it called switchLight(), which advances to   `state.color =
                the NEXT colour. Check 6 pressed r and expected           lightColors.red; drawLight();`
                state.color to be red; it was green."

**The assistance boundary held.** I supplied location, scaffold, context and feedback. **I never supplied
the target implementation**: `lightColors.red` is the model's own choice of expression - my context
quoted only the EXISTING write (`state.color = colors[index % colors.length]`) and my feedback named only
what went wrong. Every scaffold, context block and instruction is stored verbatim in
`ASSISTED-1_LEDGER.jsonl` with the full prompt head and its sha256, so a reader can check this rather
than take my word.

## What this establishes

- **Established:** this model **can** complete this addition on a page nobody tuned against, with the
  recorded assistance, and the result survives independent re-verification and its own carried-forward
  checks.
- **Observed, and stated as a sequence rather than a cause:** interventions 1-4 delivered the same
  requirement four different ways and produced no code; **the change of slot shape PRECEDED the first
  code production**, and the state facts and then the feedback preceded the first correct statement.

  **That ordering does not establish that slot shape was the sole binding constraint**, and it does not
  retrospectively explain CONSTRAINTS-1 or CONSTRAINTS-2. Other things differed between attempt 2 and
  attempt 3 - the anchor moved, the surrounding code changed, the prefix grew - and a single ordered
  sequence cannot separate them. What the sequence supports is **testing that mechanism**: hold
  everything else and vary only the slot shape, across seeds. Untested.

  The same limit applies to the last step. **The feedback preceded the success**; with one seed and one
  attempt, its effect across repeated trials is not established. It is equally consistent with the
  feedback being decisive, with the facts from attempt 4 having been enough given another draw, and with
  seed-level variation.
- **Established:** containment is doing heavy lifting on unfamiliar code - 24 and 53 lines of invented
  material dropped, in the two attempts that produced code.

## What this does NOT establish

- **Not a capability ceiling, and not a limit.** One success shows attainability. It says nothing about
  what this model could or could not do with other assistance, other budgets, or other interfaces.
- **Not reproducible GENERATION.** ONE seed, ONE attempt succeeded. Re-running the saved page is
  reproducible and was shown; re-producing the candidate from the prompt was never attempted. No claim
  that seed 1 or any other seed would succeed again, and the earlier attempts in this very sequence show
  how sensitive the outcome is.
- **Not a mechanism.** "The slot shape is what mattered" is the ordering of events, not a demonstrated
  cause; see the qualification above.
- **Not automation.** Every one of the eight interventions was mine. **A success here is a TARGET for
  automated guidance, not an instance of it.** ASSIST-1 established attainability on the farm page with
  7 interventions and turning those into an automatic policy took four further experiments.
- **Not transfer.** Page A2 is a DEVELOPMENT CASE now: I read it, and I adapted the scaffold and the
  context to what I found. Pages B (`dice`, sha `e899be776227f2bb`), B2 (`counter`, sha
  `0842a76ac9233458`) and B3 (`bars`, sha `9dff0d2dfa0329be`) remain **SEALED and unread**, generated
  before any of this assistance was designed, for exactly that future test.
- **Not a visual check.** The checks read `window.app.state()`. A candidate that set the state correctly
  and drew nothing would pass step 6. The model did call `drawLight()`, but the checks did not require
  it.

## The honest next question

The intervention that preceded code production was the slot's shape, and that is something a policy
already knows how to choose: `autoGuide`'s R2 rule produces exactly the new-listener-with-early-return
form that worked here. So the target is concrete and partly already built - on the strength of one
ordered sequence, which is a reason to test the mechanism, not a reason to believe it. **Whether the policy can select it, plus the state
facts, plus the failure feedback, WITHOUT me - on a page it has not seen - is the next experiment, and
it belongs on a sealed page.**
