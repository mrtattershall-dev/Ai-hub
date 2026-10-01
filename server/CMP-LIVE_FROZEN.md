# CMP-LIVE — three arms live: how much of Legasus's benefit survives the cheap fix? FROZEN before deploy

**Frozen 2026-10-01.** Runner `server/cmpLiveRun.mjs` (extends `inc1bRun.mjs` with a third arm; INC-1B's
runner and result are left untouched). Same fixture, model, endpoint, fresh hub per stage as INC-1B.

## Spend authorization: GRANTED, recorded before deploy

Micheal, in his own words:

> "Let's go ahead and run a 5 dollar cap on modal so it runs faster and gets more accurate results via
> wall clock time"

**Hard cap $5**, Modal, this experiment. Runner hard budget 170 min wall; per-stage timeout tightened to
5 min (INC-1B stages mostly ran < 2 min; this stops a rare stall from eating budget and keeps wall-clock
clean). Scale-to-zero; explicit `modal app stop --yes` at the end. This is separate from the INC-1 $10.

## The question CMP-1 left open

CMP-1 (deterministic, $0) showed the capability split: the cheap **load-after-write guard** catches every
Class A failure (export-a-name-you-didn't-define, load-throws) — all three real INC-1B baseline survivors —
and Legasus additionally catches Class B (loads clean, breaks an earlier behaviour). **Open: the A:B
FREQUENCY when the model runs live.** If Class B essentially never happens, the cheap guard captures ~all
the practical benefit and Legasus's margin is real-but-rare; if Class B occurs, the margin is large. This
measures it at the outcome level.

## Three arms (alternated G, SG, B per run so model-server drift lands on all three)

| arm | the path |
|---|---|
| **baseline** | ordinary hub, nothing added (`AGENT_GOVERNED_WRITES` unset, no writeScope, no governed.checks) |
| **simpleguard** | the ordinary hub PLUS one cheap fix: after each stage the runner loads the modules; if any throws, it restores the pre-stage bytes. Nothing else of Legasus. |
| **governed** | full Legasus: scope gate + behavioral acceptance (as INC-1B) |

simpleguard is the strip-Legasus control required by the standing production rule ("any benefit claim must
survive a strip-Legasus control"). Its only difference from baseline is the load-check-and-restore.

## Design & metrics (fixed now)

- N = **12 runs per arm** (36 runs), budget permitting; a run stops at the first non-EARNED stage (symmetric,
  judged on disk). Fewer only if the 170-min / $5 budget is hit, recorded as reached.
- **PRIMARY — damage left in place**, per arm (stages, and runs-with-any). Expected ordering if Class B
  occurs: baseline ≥ simpleguard ≥ governed = 0. **The gap simpleguard − governed is Legasus's marginal
  value in outcomes.**
- **A:B split of what each arm faced:** a damaging attempt is Class A if the module throws on load,
  Class B if it loads clean and fails an earlier check. Counted from `guardRestored` (A, caught by the cheap
  guard), Legasus `RESTORED` (A or B), and baseline damage-left (the unprotected truth).
- Also: stages earned, depths, scope refusals, infra outcomes (never scored as model results, runClassify).

## Interpretation (fixed now)

- **If simpleguard ≈ governed (both ~0 damage left):** the cheap load-check captures the benefit for this
  task — put it in the ordinary hub; Legasus's extra machinery is not paying off here. Honest and useful.
- **If simpleguard still leaves damage that governed does not:** that damage is Class B, and it localizes
  where Legasus begins to pay for itself.
- **If governed leaves any damage:** a failure of the governed path, reported first.
- n = 12/arm is a demonstration with a direction, not a powered significance test; reported as such.

## Not established

Generality beyond this task/model; the ancestry/receipt layer (unwired); UI activation; a logic error that
loads clean AND passes the written checks but is still wrong (no arm here would catch that — outside scope).
