# Set K — pre-registration: is the WINDOW the binding constraint?

**Committed before any GPU time.** Nothing below is edited after the window opens; the result goes in `RESULT.md`.

tatte authorised this run in his own words: **"So a real 30b aoe would be the determining factor right?"** →
**"Let's run it"** → **"You can double it"** (the budget, after I reported $7.34 left and that a doubled window did
not fit inside it).

## The question

Every hub fix this week has been justified by a mechanism and none has moved the score. The five-bucket accounting of
set H said why: of the 61 goals the MoE did not get right, **hub defects cost 2**, code-wrong cost 9, and **46 were
never attempted at all** — the window closed with 47 goals unstarted. At the observed 71.7% in-range hit rate those
47 are worth ~+34 goals, roughly **17× the entire hub-defect block**.

So this run tests the ceiling thesis directly, and it is the thesis that is on trial — not the fixes.

## Design

| | |
|---|---|
| arm | **one**: `Qwen3-Coder-30B-A3B-Instruct` (the MoE), H100, served by vLLM |
| goals | `goals-K.json` — the **same 100 goals as set H**, byte-identical (md5 verified), same hidden checker `checks-H.mjs` |
| window | **~180 min** (set H ran 110) |
| caps | `AGENT_MAX_STEPS=30`, `AGENT_MAX_MINUTES=8`, `AGENT_BATCH_ACTIONS=0`, supervisor off, fresh empty workspace |
| serving | `ai-coding-hub-indent` @ `6ae7db8` — **not main** |
| cost | ~180 min at $4.40/hr ≈ **$13.20** |

**Run ALONE.** Set J ran three arms concurrently and paid for it: 116 s/goal solo versus 165–178 s/goal three-up, and
every arm truncated at 16–18 of 20 goals. Solitude is part of the design, not a convenience.

**`AGENT_MAX_STEPS` stays at 30.** The budget audit found all 35 budget-death runs would fit inside a *twenty*-call
budget, so raising it buys nothing and would confound the one variable being changed.

## The baseline this is measured against

Set H, same goals, same checker, MoE arm: **39/100 correct, 53 goals attempted, 86.9 min of an 110-min cap.**

## Predictions, recorded before the window

1. **Goals attempted rises from 53 to ≥ 85.** This is the near-tautology that makes the rest meaningful — if a
   ~1.6× longer window does not buy substantially more attempts, the wall-clock model of the constraint is simply
   wrong and predictions 2–3 are void.
2. **Score rises from 39 to ≥ 60.** The ceiling estimate is ~75 (47 unstarted × 71.7%); 60 is the floor at which the
   thesis survives.
3. **Score per goal ATTEMPTED stays within ±10 points of set H's 39/53 = 74%.** If reach is really the constraint,
   the later goals should convert at roughly the rate the earlier ones did.

**Falsified if:** attempts rise well past 53 and the score does not follow. That outcome would say the unstarted
goals were never worth 71.7% — that the run was reaching goals it could not do anyway — and it would move the
binding constraint back to capability. That is a finding, not a disappointment, and it is the one I would bet
against at even odds.

## What this run does NOT test

The three fixes committed tonight (`d80b38f` context window, `579a41a` outline, `6ae7db8` refusal hand-back) ride
along because they are in the served tree, but **this design cannot attribute anything to them**: there is no
matched control arm, and the window changed at the same time. Any score movement is confounded between "more time"
and "better hub". Only prediction 3 speaks to them at all, and weakly.

## Rules for the window

- Status file written **before** any GPU time so the watchdog arms first. Stops go through `stopApp.mjs` **only**
  (Rule 7a) — `modal app stop` prompts and aborts non-interactively, which once let a run overrun.
- `watchdog.sh` at the cap, with an app name unique to this run so a stop targets exactly one thing.
- **Rule 3**: `trialH.mjs` polls `/api/health` and refuses to measure an endpoint whose identity does not match, so
  the served model is proved before goal 1. The `ENDPOINT {...}` line in the log is the evidence.
- Laptop on AC — verified `BatteryStatus=2`, 100% (a battery sleep cut set E at goal 64).
- `HUB_ENTRY` is set explicitly to the `-indent` tree. The harness defaults to **main**, which carries none of the
  fixes; that default would have voided the window while every record claimed otherwise.
- Provenance: `trialH.mjs` now derives the recorded hub SHA from the tree it actually serves, instead of always
  reading main's HEAD.
- `server/hub.json` holds provider keys and is never copied into these records.
- Independent `python -m modal app list --json` at the close. Confirmed `[]` (nothing deployed) before starting.

## Records kept

Run files, full transcripts, traces, run index, and the workspace git bundle — the same set as sets H/I/J, which is
also what makes the offline replay corpus.
