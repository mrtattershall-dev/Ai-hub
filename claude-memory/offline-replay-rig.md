---
name: offline-replay-rig
description: "The hub loop can now be regression-tested free from 1,759 recorded real model responses; it caught a fix that was inert"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T20:54:54.697Z
---

Built 2026-09-10 in ai-coding-hub. `server/testdata/model-corpus.jsonl` holds **1,759 unique
real model responses** harvested from 396 runs across four model sizes — 106 distinct response
shapes, 102 that pack several actions into one reply, 20 that try to overwrite the workspace
boundary marker. Two suites drive it, both offline and instant:

    server/parserCorpus.test.mjs   every response through the parser; asserts INVARIANTS
    server/mockLoop.test.mjs       the WHOLE loop against a replay server; asserts nothing
                                   gets destroyed (marker intact, no unparseable code left)

**Why it exists:** the pre-existing suite scripts the model, and the script is written by the
same author as the assertions — so replies always parse, always carry a PATH, always finish.
32 green suites coexisted with three parser bugs and a marker-overwrite that destroyed 9 of 67
workspaces.

**It immediately caught a fix of mine that was INERT.** The syntax rollback only read `HEAD`,
but every checkpoint after a bad write commits the damage, so by teardown HEAD holds the
broken file. It read correctly, had a green test, and would have repaired almost nothing.
Corrected to walk the file's history for the last version that parsed.

**How to apply — the discipline that made it real, not decoration.** A passing invariant test
proves nothing unless you check it CAN fail:
  1. assert COVERAGE (the attack was actually attempted this run, counted per response)
  2. disable each guard in turn and confirm the matching invariant goes red
  3. re-enable and confirm green
The first version passed with the marker guard disabled — it never attempted the attack.

**Limits, stated so nobody over-claims it.** A replay cannot react to what the hub says back,
so it can prove the loop SURVIVES real output but not that it makes PROGRESS. Do not score
goals against it. It covers 4 of 6 bug classes found that day; advisory-nudge behaviour and
model quality still need a live model. See [[advisory-vs-mechanical-recovery]].

## 2026-09-11: per-run replay scenarios (measurements/replay/) - the "mock model" tatte values most
tatte: free replays for bug patches are worth more than a training run; gather everything for run F.
- run.history is a PRUNED context window (MAX_HISTORY_MSGS 16), not a transcript: set C lost 248 of coder3's 568
  replies. run.steps is never trimmed. reconstruct.mjs rebuilds lost replies from steps in the parser's own format;
  validated on every unpruned run: counts 45/45, actions 269/269, parser round-trip 269/269.
- build-scenarios.mjs: one scenario per goal = start workspace (from the run files' own checkpoint steps,
  runstates.mjs), every reply in order, hub replies, verdict, tags. 120/120 complete for coder3 A/B + set C.
- replay-run.mjs replays a scenario through any hub (--hub = a worktree). B14 replay reproduced the original
  exactly (done, 3 gate blocks) on main and showed forcedFinish true on the e-fixes branch - a patch proven on real
  recorded behaviour for $0.
- e-fixes branch (b2eb21d, not merged until set D ends): hub writes <id>.transcript.jsonl (full, untrimmed),
  so from set E on scenarios need no reconstruction. See [[coder3-base-34of40-2026-09-11]].
- 2026-09-11 set D: scenarios setD-coder30b g33-72 (21/40 complete) + g72-100, and setD-coder14b-base-g61-100 (40,
  the 14B's only surviving run files). traces.jsonl steps are SKELETONS (type/tool/path only - no thought, no args),
  so a deleted run file = its replies are gone for good: 60 of the 14B's 100 set D goals are unrecoverable.
- Set E harness (measurements/2026-09-11-setE/tools/trialE.mjs + run-setE.sh) fixes that at the source:
  AGENT_MAX_RUN_FILES=100000, runId logged per goal, and run files + transcripts + traces + a workspace git bundle
  copied to runs/<label>. Transcript files are validated by the fuzz TRANSCRIPT invariant and reaped with their run.
