---
name: measure-the-thing-itself
description: "Eight proxy misreads in one session on the hub project — when a number surprises you, measure the thing itself before building anything on it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T22:50:12.334Z
---

2026-09-12, one session: eight times I reasoned from a proxy and the direct instrument refuted me. Four on wall
clock (see [[wall-clock-is-not-model-latency]]), one on Python import semantics, three on the loop guard.

**Why:** each proxy was *plausible* and each was measuring a different quantity than the one I cared about.
"Calls since the last landed write anywhere in the run" is not "did work land between the repeated replies."
"Goal seconds ÷ model calls" is not model latency. "The output file has 4 rows" is not "the job aborted." Every
time, the real instrument was already on disk — `callStats`, `run.recent`/`run.recentAt`, the file's mtime — and
reading it took one command.

**How to apply:** before building a fix on a surprising number, ask what quantity the number actually is, and
whether the system persists the real one. Three specific traps that bit me: (1) reconstructing a value by
apportioning it evenly across steps invents adjacent-off-by-one differences that look like signal; (2) comparing
a field across a whole window when the code compares only matching entries manufactures a "spread"; (3) a
partial output file from a long job is normal mid-flight — check mtime before concluding it died. I deleted a
running job's output on that last one and destroyed real progress.

The costly version of this is shipping the fix. The cheap version is one command. Red-first testing caught two of
the eight before they became code — an import check I nearly shipped for a defect that doesn't exist died because
the test I wrote to pin it refuted the premise.

Related: [[silent-failures-are-the-class]], [[verify-the-path-the-change-is-on]], [[baseline-consumers-before-changing-shared-code]].

2026-09-25, two more of this class in one session: joined runs by TASK NAME (not a key when replicated — changed a substantive conclusion), and watched TOOL NAMES for diagnostic freshness (missed run_python writes). Both replaced by the thing itself: unique run id with a one-to-one assertion, and the target file's sha256 before/after every tool. Also: a monitor grep whose alternation contained COMPLETE matched PRESERVE_INCOMPLETE, surfacing only failing units.
