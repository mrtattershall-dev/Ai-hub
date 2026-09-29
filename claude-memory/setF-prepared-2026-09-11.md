---
name: setf-prepared-2026-09-11
description: "Set F (100 new interleaved goals, 10 new projects) is built and validated - refs 100/100, empty 0/100, 69/69 mutants; tatte chose a fresh set, BOTH models (raising the $30 cap to ~$33) and batch actions off; launch waits for AC power"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T21:54:21.838Z
---

measurements/2026-09-11-setF (committed d39f40a; COORD f446c21). Same shape as D and E: 10 projects x 10 steps,
interleaved (goal = (step-1)*10 + project), s prefix. New domains: s1 library (loans/holds/fines), s2 access-log
analyzer, s3 matrix, s4 markdown, s5 expression evaluator, s6 directed graph, s7 LRU+TTL cache, s8 gradebook,
s9 kanban board (browser), s10 desk built on s1 AND s7 (so a dropped export or a changed rule shows up there too).

tatte's calls, verbatim: "Fresh f set"; models "14B + Qwen3-Coder" (the option stating ~$10 worst case, ~$3.3 over
the $30 cap - the cap is therefore raised to ~$33); batch actions "Off, as in D and E".

Validated before any model saw the goals: refs/ 100/100 both ways, empty 0/100, tools/mutate-F.mjs 69/69 caught
exactly. Harness trialF/run-setF dry-run proven on a mock (run files, transcripts, traces, git bundle). Hub = main
with the seven set-E fixes (server/ at b3c2614). Caps: coder30b-setf H100 120/125 min, coder14b-setf A10G 95/100.

**Why:** F is the first run on a hub whose long-run bugs were found and fixed from real transcripts (see
[[setE-findings-2026-09-11]]), so it measures whether the fixes change what the models actually achieve.
**How to apply:** never start the GPU window on battery - set E lost 36 goals to a battery sleep; the laptop must be
on AC and a keep-awake power request must run for the window. Pause the offline fuzzer for the window, resume after.
See [[long-run-accuracy-north-star]], [[hub-target-14b-coder]].
