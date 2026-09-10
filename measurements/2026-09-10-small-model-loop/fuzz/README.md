# Fuzz campaigns — raw logs

Seeded replays of 1,759 real model replies through a fresh, isolated hub (`server/fuzzLoop.mjs`).
Deterministic: any seed here reproduces with `node server/fuzzLoop.mjs 1 <goals> <seed>`.

| log | seeds | goals/iter | code |
|---|---|---|---|
| campaign-A.log | 1–40 | 4 | before the fuzz-round fixes — **died at iteration 10** (exit 127, no summary) |
| campaign-B.log | 1001–1040 | 6 | before — stopped by hand at 15 to avoid mixing old and new code |
| campaign-C.log | 1–40 | 4 | after — all 40 completed |
| campaign-D.log | 1001–1040 | 6 | after — all 40 completed |
| fuzzforever-*.jsonl | 100000+ | 4 / 6 | continuous fuzzer against `main`, one file per batch |

`before-after-transitions.txt` attributes every per-seed change to its real cause. Read it before
citing any before/after number: on the seeds both runs covered, **every** improvement was a
measurement correction — the fuzzer learning to answer approvals, and the checker learning to
tell ESM apart from broken code. **Zero** seeds were repaired by a hub change. The narrative
write-up follows once the four worktree agents report.
