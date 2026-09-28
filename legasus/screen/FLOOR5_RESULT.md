# FLOOR-5 — the non-zero-floor regression. **The test catches a hardcoded zero; the guidance reached a correct non-zero floor in one call.**

2026-09-28, **$0**, local, `qwen2.5-coder:1.5b`. Same frozen policy as SEQ-1, unchanged.

**The subject is HAND-WRITTEN by me**: a scoreboard whose `playerA` starts at **5**, with the reset
already present and the decrement absent. It is a regression fixture, **not evidence of transfer**, and
**not evidence that SEQ-1's zero-floor answer was wrong** - that answer was correct for its own load
value of 0. This tests something different: whether the task generator derives the floor from the load
value, and whether the guidance can reach a floor that is not zero.

## OUTCOME 1 — THE TEST. Does a hardcoded zero floor get caught?

**Yes.** Two hand-written implementations, judged by the emitted checks. This says nothing about the
guidance; it is a statement about the instrument.

    hand-written, floored at the LOAD VALUE      10 of 10 PASS
      playerA = Math.max(5, playerA - 1)

    hand-written, floored at a HARDCODED ZERO    FAILS at step 6
      playerA = Math.max(0, playerA - 1)         expected playerA 5, got 4
                                                 and step 7 fails downstream

**The checks the generator emitted are exactly the ones needed**, and the floor in them was derived from
the observed load value rather than assumed:

    press a, a   7      the state is moved away from its starting value
    press z      6      decrements
    press z      5      decrements to the floor
    press z      5      DOES NOT GO BELOW IT          <- the step a hardcoded zero fails
    press a      6      the existing key still works
    press 0      5      the earlier feature still works

`emitTask2` computes every expectation from `floorValue = loadState[field]`, so on this page it is 5.
**SEQ-1's accepted `Math.max(0, ...)` would fail this test** - which is what makes the limitation recorded
in SEQ-1 concrete rather than theoretical.

## OUTCOME 2 — THE GUIDANCE. Can Legasus produce a correct non-zero floor?

**Yes, on this page, in one call.**

    accepted             round 1, seed 1
    calls                1 of 12
    requested checks     10 of 10 PASS
    carried-forward      the page as delivered, including its reset: all 6 PASS
    protected failures   0      restored 0      interventions 0
    verified             rebuilt to sha MATCHING the judged candidate; fresh re-run 10 of 10, 0 errors

**What the model wrote:**

    playerA--;
    if (playerA < 5) playerA = 5;
    updateScoreboard();

Not `Math.max(0, ...)`. A correct floor at the page's actual starting value, in a different form from
either hand-written fixture.

**Where the 5 came from, precisely.** Not from the extracted facts - those were only the declarations:

    // FACT line 9: playerA is declared `let`.
    // FACT line 19: existing code writes it as if (e.key === 'a') { playerA++; updateScoreboard(); }

It came from the **instruction**, which `buildInstruction` renders verbatim from the task's requirement:

    // on this key: playerA is one lower. Ensure playerA never goes below 5.

And that requirement was written by `emitTask2` from the observed load value. So the chain that produced
the correct floor is **generator observes load value -> requirement states it -> instruction carries it
verbatim -> model uses it**. The facts contributed the declaration, not the bound.

## Keeping the two apart

    a deliberately faulty implementation being rejected    validates THE TEST
    Legasus producing a correct implementation             validates THE GUIDANCE on this case

Both happened, and neither substitutes for the other. A test that rejects the faulty fixture would be
worth having even if the guidance had failed; guidance that succeeds against a test which cannot fail
would be worth nothing.

## What this does NOT establish

- **Not transfer.** I wrote this page.
- **Not that SEQ-1 was wrong.** Its answer was correct for a load value of 0. What SEQ-1's checks could
  not do was TELL THE DIFFERENCE, and that is the limitation this fixture makes concrete.
- **Not reproducible generation.** One seed, one call, one success, unrepeated.
- **Not that the facts carry bounds.** On this page the bound came from the requirement text. Whether
  extraction could supply a bound the requirement omitted is untested.
- **Not visual correctness.** This page conforms to the 400-pixel fixture layout, but the display was not
  checked here; only the state was.

## Also preserved: an earlier floor-3 attempt that failed

Before moving to the value of 5, a hand-written floor-**3** subject was tried, and its RESET addition
**got no success within the budget**: 6 of 12 calls, the escalation rule fired, and no code was produced
at either scaffold shape. It is kept rather than dropped when the fixture changed. It is a failure on a
hand-written page whose shape differs from the generated ones, and nothing here explains it.
