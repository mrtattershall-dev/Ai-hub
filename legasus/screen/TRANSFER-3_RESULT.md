# TRANSFER-3 — **the frozen policy extended an unfamiliar page by itself. 3 calls, 0 interventions, $0.**

2026-09-27, local, `qwen2.5-coder:1.5b`. Definition and policy hashes frozen at `aa22d06` **before any
page of this set was generated**; the policy did not change after generation began.

**The two outcomes, kept separate as required.**

## OUTCOME 1 — BASELINE ELIGIBILITY: can a generated page support the experiment?

**3 of 8 pages qualified. Eligibility rate 37.5%.** Every page and every rejection is preserved on disk
with its `GENERATION-LOG.txt`; nothing was discarded.

    s3-01-square   INELIGIBLE  NO_FREE_TRIGGER_KEY - it changes state on EVERY key, including all four
                               candidate triggers, so no trigger was free
    s3-02-votes    INELIGIBLE  NO_EXISTING_BEHAVIOUR
    s3-03-bright   INELIGIBLE  NO_EXISTING_BEHAVIOUR
    s3-04-colour   ELIGIBLE    {"colorIndex":0}, responds to c, trigger '0'   <- USED
    s3-05-stack    ELIGIBLE    {"stack":[]}, responds to a and b, trigger '0'
    s3-06-scores   ELIGIBLE    {"playerA":0,"playerB":0}, responds to a and b, trigger '0'
    s3-07-grid     INELIGIBLE  NO_EXISTING_BEHAVIOUR
    s3-08-bars     INELIGIBLE  NO_EXISTING_BEHAVIOUR

Four of the five rejections are the same rule: the page draws something but no key changes its state.
**The subject is the FIRST eligible page in the declared order**, not a chosen one - and it is worth
noting that the two later eligible pages have richer state, so the order did not hand me the easiest
subject available.

All eight generations completed (`doneReason: stop`), so the truncation rule rejected nothing this time -
unlike the previous set, where it disqualified `dice`.

## OUTCOME 2 — ADDITION SUCCESS: can the policy extend it while preserving the carried-forward checks?

**Yes, on this page.**

    accepted              round 1, seed 3
    calls used            3 of 12
    interventions         0 - the program has no way to accept one
    requested checks      7 of 7 PASS
    carried-forward       PASS - the page's own `c` behaviour, unchanged
    errors                0
    disposition           RETAIN
    protected failures    0        restored 0
    generation            122.3 s over three calls
    dollars               0

**What the policy produced by itself**, all of it code-generated:

    site         R1 - "a keydown listener already dispatches on key values and does not exclude this
                 key, so a branch goes inside it"
    scaffold     if (e.key === '0') { // FILL IN }
    instruction  // on this key: every piece of state is back to its starting value.
    context      // FACT line 14: colorIndex is declared `let`.
                 // FACT line 18: existing code writes it as colorIndex = (colorIndex + 1) % 3;
                 (1 fact delivered; the `ctx` constraint was dropped at the 240-character budget)
    feedback     none was needed - it succeeded in the first round

**What the model wrote**, kept by containment from a 13-line completion with 10 lines dropped:

    colorIndex = 0;
    ctx.fillStyle = `rgb(${colorIndex * 100}, ${colorIndex * 100}, ${colorIndex * 100})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

**Verified independently:** rebuilt from the run record to sha `03603335cacacc12`, which **matches the
judged candidate**, then re-run in a fresh process and browser - 7 of 7 again, 0 errors. That is
**reproducible execution**. **Reproducible generation is untested**: nothing here shows the same prompt
would produce that candidate again.

## TWO THINGS HERE CUT AGAINST MY OWN EARLIER EXPLANATION

**1. The R1 shape produced working code.** ASSISTED-1's sequence had the `if (e.key === x) { }` slot
yield no code across four attempts, and I described the switch to an early-return listener as the point
where code appeared. **Here the policy chose R1, and seed 3 wrote code that passed everything.** Seeds 1
and 2 were refused EMPTY, so the shape does look harder - but it is plainly not barren, and the escalation
rule never had to fire. This is direct evidence that **"the slot shape was the binding constraint" was too
strong**, exactly as cautioned. Two of three seeds failing and one succeeding is a difficulty, not a wall.

**2. One fact was delivered, not three.** At the 240-character budget the `ctx` constraint was dropped.
The delivered facts were the declaration of `colorIndex` and how existing code writes it - and that was
enough on this page. Nothing here shows the facts were necessary: no arm ran without them.

## What this establishes

- **Established:** on this page, the frozen policy chose the site, the scaffold, the instruction and the
  context by itself, and reached an accepted addition that passes the requested checks and every
  carried-forward check, with **zero human interventions and zero protected-set failures.** That is the
  milestone this line has been working toward: **one useful addition caused by automatically selected
  guidance, on a page nobody tuned against.**
- **Established:** the eligibility procedure functions in both directions - it passed a known-good control
  page, and it rejected 5 of 8 real pages for stated mechanical reasons.
- **Established:** containment still does real work on unfamiliar code - 10 of 13 lines dropped.

## What this does NOT establish

- **Not reproducibility, of either kind.** One page, one accepted seed. 2 of 3 seeds in that very round
  were refused, so the per-seed success rate here is 1 in 3 and no claim is made that a repeat would
  succeed.
- **Not generality.** One page, one model, one requirement shape ("one key restores the load state"), one
  edit interface. The two other eligible pages were not attempted.
- **Not that the extracted facts were necessary.** Every arm had them; no control ran without them.
- **Not that the escalation rule works.** It never fired.
- **Not that the ask was fulfilled.** The page is a colour-name page whose visible output the candidate
  now paints as a grey ramp from `colorIndex`; the checks test **state**, not pixels, and the
  carried-forward checks establish **preservation of observed behaviour and nothing more.** Whether the
  page is a good colour-name page was never in scope.
- **Not a capability claim about the model**, in either direction.

## Call accounting, separate and unsummed

    additionAttemptCalls     3 of a 12 budget   <- the experiment
    pageGenerationCalls      8                  this set
    priorPreparationCalls    5                  4 pages on 2026-09-27 plus 1 regeneration
    browserProbeRuns        ~20                 eligibility, observation, task emission, verification
    oracleCalls              0
    interventions            0
    dollars                  0

**Total model calls spent to reach this result: 16** — 3 attempts, 8 generations for this set, 5 earlier
preparation. The 3 is the experiment; the other 13 are what it cost to have a subject at all.
