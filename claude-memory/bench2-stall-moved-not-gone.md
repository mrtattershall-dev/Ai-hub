---
name: bench2-stall-moved-not-gone
description: 2026-09-24 BENCH-2 (7B, supplied file + earlier warning): outline-stall gone, edits 7 vs 4, verified 0/15 vs 2/15, 3 regressions restored; 4 runs lost to model calls that never returned
metadata:
  type: project
---

BENCH-2 (2026-09-24, hub ec71665, Qwen2.5-Coder-7B on Modal A10G, ~47 min, <$1 of $10 cap) re-ran BENCH-1's frozen definition with the supplied-file context and the earlier repeat warning. Supplying the target file changed the FIRST MOVE (outline-first 3/15 vs >=12/15) and raised edit attempts (7 vs 4) but verified repairs went 2/15 -> 0/15 and candidate regressions 1 -> 3 (all restored). The identical-reply stall reappeared on run_python / search_file / edit_file. Four of six timeouts were model requests that never returned (empty reply after ~290s); Modal kept only the last 12 request log lines. Chain step 1 asked for verify_project (removed by route bounding) and the hub said "could not parse an action".

**Why:** tatte's framing: this is movement through the workflow, not productivity; report edit attempts, accepted repairs and regressions as separate counts; n=1 before/after attributes nothing.

**How to apply:** never cite BENCH-2 as evidence the supplied-file feature helps or hurts. Before another paid run: per-call deadline shorter than the task budget + a server-side request log; fix the removed-tool message on the bounded path. Next connection tatte named: acceptance policy for governed UI runs (see [[legasus-production-decision-2026-09-22]], COMPONENT-CONNECTIONS.md).
