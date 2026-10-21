# REL-1 — does warning a 7b that it is looping, before stopping it, change what it achieves?

Frozen before the treatment exists in code. The commit that adds this file contains no implementation of it;
the implementation, its tests and every run come after, and any change to what follows is an amendment recorded
forward, never an edit of this text.

## Why this question

On 2026-10-21 the live collector (`server/gather.mjs`, qwen2.5-coder:7b on CPU) finished three goals in session 2.
All three were ended by the hub's repetition guards, not by success, failure or budget:

    f5e9d8ce  "the same call (list_dir .) was sent 5 times and SUCCEEDED every time"   (call guard, agent.js)
    dfaa3dc9  "the model produced the same response 3 times in the last 7 steps"        (reply guard)
    887cca25  "the model produced the same response 3 times in the last 5 steps"        (reply guard)

Both guards STOP on detection. The only existing leniency is one pardon when the model was just handed new
information (the substitution path). The model is never told it is repeating. inferstep/ATLAS (read 2026-10-21,
research report "Atlas coding agents for Legasus") nudges before it kills; the idea is borrowed, not its code.

## Arms

    CONTROL     the guards as they are at the freeze commit.
    TREATMENT   AGENT_REPEAT_WARN=1. The FIRST time either guard would stop a run, it does not: the turn's
                result carries a warning naming what was repeated and telling the model to do something
                different. The SECOND detection in the same run stops it exactly as CONTROL does. Nothing
                else differs - same prompt, model, goals, budgets, gates and flags.

The treatment buys at most ONE extra detection per run. It cannot remove the stop, only defer it once.

## Design

- Unit: one goal. Pool, order and prerequisite rule: gather.mjs at the freeze commit (the fuzzer's GOAL_POOL,
  `withPrerequisites`). Model qwen2.5-coder:7b via Ollama, this laptop, CPU only.
- PAIRED sessions. Each seed s runs twice on fresh, isolated hubs - once per arm - with the arm order alternating
  by seed (odd: CONTROL first; even: TREATMENT first), so the same goals in the same order reach both arms and
  slow drift (thermal, swap, Ollama cache) does not line up with an arm.
- Seeds 101 to 110: 10 seeds x 5 goals = 50 goals per arm. Fixed in advance; no early stop, no extension on the
  result. A session that fails to start (hub error) is re-run with the same seed and recorded as such.
- Environment for both arms: AGENT_FINISH_EVIDENCE=1, AGENT_WEB_QUARANTINE=1, worker ceiling 1g/2 cpus,
  MODEL_FIRST_BYTE_S=1200, 240 min/goal - gather.mjs's values at the freeze commit.

## Endpoints, read from typed records only (data/gather/sessions.jsonl, each run's JSON, server/enoch/enoch.jsonl)

    R1  PRIMARY. Share of goals ended by a repetition guard: the run's last error step is one of the two
        guard messages above. Prediction: TREATMENT < CONTROL. Direction only; no effect size is claimed.
    R2  Share of goals that finish VERIFIED (finishKind 'verified' or 'screen_checked'). Prediction: TREATMENT
        >= CONTROL. A warning that only converts loop-stops into forced or unverified finishes is not a win.
    R3  Share of goals the postmortem Watcher judges goal_met = 'yes'. Prediction: TREATMENT >= CONTROL.
        Reviewer verdicts are leads, not ground truth; R3 is reported, never used alone.
    R4  HARM. Median model calls per goal and share of goals hitting the step or minute budget. Prediction:
        TREATMENT is not worse by more than one call at the median, and budget hits do not rise.
    R5  SENSITIVITY CONTROL. Count of TREATMENT runs in which a warning was actually issued. If it is 0 the
        arm never differed from CONTROL and every comparison above is reported as UNINFORMATIVE.

Analysis: per-endpoint counts per arm; paired by seed and goal position; exact two-sided test on R1 and R2
(Fisher), reported with the counts. 50 per arm is small: a null result is "not detected at this size", never
"no effect". Every goal is reported, including ones that end in error.

## What would falsify the idea

R1 not lower in TREATMENT with R5 > 0, or R2/R3 lower in TREATMENT, or R4 harm. Any of these is a result, and
is written up as one.

## Not in scope

The parse-feedback categories, the one-step tool ban and the read-only nudge are separate interventions
(REL-2..4), each frozen and run on its own. Ollama's JSON `format` is NOT pursued: it constrains the whole reply,
which would replace the plain-text protocol with JSON tool calls, measured here to break 7B models.
