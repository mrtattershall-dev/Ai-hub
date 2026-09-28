# STEP 4, part 1 — the specimens were nearly lost, and the substrate that recovered them

Owner's decision: the **six set G survivors** are the primary specimens; `to_html` x3 is a
calibration control; do not pool them. Route attribution happens BEFORE any intervention.

Attempting that attribution found a problem with the evidence base and then a better instrument.

## THE SIX ARE NOT ATTRIBUTABLE FROM PRESERVED ANALYSIS

    measurements/2026-09-11-setG/coder30b-setg-regress.txt
        "78 goals run | worked when written 33 | works at the end 29 | REGRESSED 6"

That is the whole file - a summary line, no per-goal enumeration. Its own note says it was
"recovered from the completed analysis task" after being committed EMPTY at `0130652`, because
`regress.mjs` parsed the checker output without checking spawn status. **The number survived; the six
identities did not.**

Nor can they be reconstructed from what set G preserved:

    measurements/2026-09-11-setG/data/coder30b-setg/   workspace only, FINAL state
    that workspace                                     has NO .git - no checkpoint history
    runs/ under set G                                  ABSENT
    set F, by contrast                                 runs/coder30b-setf/runs/ IS preserved
    set F's per-goal shas (e.g. 319c4be)               workspace-local, repo gone, unreachable

So set G kept a summary and a final directory. Set F kept run records. **Neither kept the thing the
other did**, and the field that made set F's rows attributable - `state`, a workspace commit - points
into a repository that no longer exists.

This is the recorded-and-undone hazard arriving as lost evidence: an analysis whose INPUT was
discarded once its OUTPUT was summarised.

## AND THE SUBSTRATE THAT RECOVERS THEM

`measurements/replay/scenarios/setG-coder30b-setg.jsonl` — **78 scenarios, one per goal**, each with
the model's recorded replies, the goal text, and the start state it began from.

`measurements/replay/replay-run.mjs`, by its own header:

> replay recorded scenarios through a REAL hub with a mock model. Free, offline, deterministic. ...
> an isolated hub (its own port, workspace, queue, runs, traces - nothing live is touched) is started
> from `--hub` (default: this repo's server; **pass a worktree's server/index.js to test a patch**)

That is a purpose-built A/B rig for steps 3-5, built by the hub for hub patches:

    step 3  baseline worktree      --hub <route-complete baseline>/server/index.js
    step 4  Legasus worktree       --hub <governed boundary>/server/index.js
    step 5  removal control        --hub <boundary removed, checks kept>/server/index.js

Identical recorded inputs, isolated workspaces, no model, no GPU, no live state touched. Smoke-tested
at **15s per scenario**, so all 78 is ~20 minutes.

## THE ATTRIBUTION FIELDS ARE ALREADY IN ITS OUTPUT

One replay emits, per scenario:

    destructiveRefused, refusedNamed     the preservation refusal FIRED, and on which file:symbol
    defLossWarnings, defLossNamed        a definition loss was DETECTED and only WARNED
    exportLossWarnings, exportLossNamed  an export loss detected and only warned
    rollbackNotes                        end-of-run repair activity
    approvals                            shell route decisions, e.g. ["run_command:denied"]
    noChangeEdits, gateBlocks, toolLoopStops
    sameAsOriginal, exhausted, served/recorded

**The discriminator falls straight out of that:**

    destructiveRefused > 0                     the route PARTICIPATED in the mechanism
    defLossNamed or exportLossNamed non-empty
      WHILE destructiveRefused == 0            DETECTED BUT NOT REFUSED -> the signature of
                                               ROUTE_BYPASS or the advisory path

## WHAT CHANGED, AND WHAT DID NOT

**Changed:** the specimens are produced by replaying set G's recorded replies through CURRENT code,
not read out of the 2026-09-11 analysis. Current code is the right reference because the baseline
will be built against it, and `sameAsOriginal` reports where current code diverges from the
recording.

**Not changed:** the owner's roles hold. Set G replies remain the primary specimens - post-fix
material, answering "what escapes after the obvious fix exists". `to_html` x3 from set F remains the
calibration control. They are not pooled.

## TWO LIMITS OF THIS SUBSTRATE, STATED BEFORE THE NUMBERS

1. **A replay is not a re-run.** The mock cannot react; it serves what the model originally said. So a
   case where current code REFUSES and the original model would have resent the file complete shows
   as refused plus `exhausted`, NOT as recovered. The rig measures *hub behaviour given fixed model
   output*, which its own header says, and for a destruction question that is the right measurement:
   did the destructive write land.
2. **"Post-fix under current code" is not "the six".** Set G ran on post-`4764bde` code; trunk has
   moved since. Any count from this replay is a well-defined measurement of current code on set G's
   replies, and is NOT a recovery of the original six. It will not be reported as one.

## ONE INCIDENTAL OBSERVATION, NOT A FINDING

Scenario g001 reports `refusedNamed: ["_snippet.py: Library"]` - the preservation refusal firing on
`_snippet.py`, which is `run_python`'s scratch file. Whether a refusal on a scratch snippet is a
false positive is unmeasured and is not part of this experiment. Recorded so it is not rediscovered.

Attribution run in flight. Nothing built. Trunk untouched. Specimen frozen.
