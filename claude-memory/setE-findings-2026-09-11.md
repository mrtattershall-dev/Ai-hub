---
name: sete-findings-2026-09-11
description: "Set E (100 interleaved goals on the set-D-fixed hub 421ce9e): 14B 12/100, Qwen3-Coder 35/100 but CUT AT GOAL 64 by a battery sleep; 7 more hub fixes on f-fixes found in full transcripts; 164 replay scenarios for run F"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T21:06:11.084Z
---

Set E ran 2026-09-11 11:10-12:37 (measurements/2026-09-11-setE, pre-registered, tatte's go: "Continue").
- Base 14B: all 100 goals; hidden checks 12/100 as asked, 15/100 implementation. Qwen3-Coder: 35/100, but the
  laptop SLEPT ON BATTERY 12:37-14:27 and cut it at goal 64 (36 goals never started) - not comparable to the
  55-75 prediction. q4 0/10 for both is REAL (neither exported render at the end).
- Record keeping worked: 100 + 64 run files, as many full transcripts, git bundles (set D had lost most).
- Sleep lesson: watchdogs use wall-clock deadlines inside the sleeping laptop, so they fired only on wake. The apps
  scale to zero 120 s after the last request, which is what kept cost to ~$7.5 (running total ~$23.3 of $30).

Hub fixes found in E's transcripts, each with a mutation-proven test, MERGED INTO MAIN 2026-09-11 after the full
suite passed (branch and worktree removed): dropped model connection retried (947c48d); leftover tasks scoped to the
goal's files, verify_project checks the goal's own file and language, FIND==REPLACE edits say NO CHANGE, a stored
value hiding a method is named (f62768e); a rewrite that drops module.exports names is warned (b3c2614 - Qwen goal
54 lost render that way; measured cost 6 steps). The live hub was not restarted, so it still runs the old code.
Trigger counts in E (14B / Qwen): stale leftovers shown 688 calls / Qwen closed 45 leftover tasks instead; no-op
edits 41 / 0; verify_project on the wrong file 2 of 2 / 5 of 5; repeat-guard stops 75 / 6.

**Why:** tatte - free replays for bug patches are worth more than a training run; run F must have the most accurate
data. Every fix here came from what a real model was told in a long run.
**How to apply:** keep the laptop on AC for any GPU window; merge f-fixes before F and replay E's 164 scenarios
(measurements/replay/scenarios/setE-*.jsonl) through it first. See [[setD-long-run-findings-2026-09-11]],
[[offline-replay-rig]], [[long-run-accuracy-north-star]].

Regressions (every goal's end state known - 100/100 and 64/64, vs 49 and 1 in set D): 14B 5 of 19 that worked when
written (q6 rewrites, q8 convert signature change, q9); Qwen3-Coder 8 of 41 - all eight are q4/q10 steps ending in
"render is not a function" (the module.exports line dropped at goal 54). MEASURED counterfactual: restoring that one
line on a copy of the final workspace -> 41/100 instead of 35 (5 of the 8 recover, plus goal 74 it never reached);
goals 24, 34, 40 have a second fault behind the first. So the one line cost 6 steps, not 8.
