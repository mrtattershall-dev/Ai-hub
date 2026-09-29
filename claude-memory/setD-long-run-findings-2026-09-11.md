---
name: setD-long-run-findings-2026-09-11
description: set D (100 interleaved goals) - coder3 52/100, 14B 5/100; hub silently lost work (rewrites, rollback, dead checkpoints, deleted run files); 6 fixes on e-fixes proven by replays
metadata:
  type: project
---
2026-09-11 set D: 10 projects x 10 steps, interleaved, hidden checks on the final workspace.
Qwen3-Coder 52/100 (0 CT), base 14B 5/100 (mostly never built the steps).

Deep hub bugs set D exposed (all fixed on branch e-fixes, each test fails without its fix, merge after full suite):
- one approval request deadlocks an unattended run (AGENT_UNATTENDED=1 denies instead);
- checkpoints died silently (a model-made file name ending in '.', a stale index.lock) - no undo history after;
- evictOldRuns deleted run FILES past 40 (records of goals 1-32 gone);
- whole-file rewrites dropped working functions (guard names them; real goal-46 replay fired);
- the end-of-run syntax rollback deleted new work (note names it + "Re-add" ledger task; real goals 43/93 replays).
Forensics: 7 working functions coder3 wrote were later deleted (5 rewrites, 2 by the hub rollback).

**Why:** tatte's north star is long runs staying accurate ([[long-run-accuracy-north-star]]); these are the
mechanisms that silently undo earlier work. Replays of real recorded runs prove fixes for $0 ([[offline-replay-rig]]).
**How to apply:** set E runs on the fixed hub (after merge); compare deletions/regressions with D. Still open for
tatte: AGENT_BATCH_ACTIONS on for E? (coder3: 34 of 298 D replies multi-action; some replies repeat ACTION 100+ times).

**Merged 2026-09-11 10:4x:** all set-D fixes are in main at 421ce9e (plus transcripts are JSONL-checked by the fuzzer and
reaped with their run). Full suite 60/60 offline. Live hub NOT restarted (tatte's word only). Set E harness
(trialE/run-setE) dry-run proven on 421ce9e; E waits on tatte's two calls: AGENT_BATCH_ACTIONS (rec. off) and
approval policy (rec. harness approves git_commit/git_undo, as in D). See [[offline-replay-rig]].
