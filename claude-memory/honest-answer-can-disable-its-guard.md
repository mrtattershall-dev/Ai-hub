---
name: honest-answer-can-disable-its-guard
description: "Making a tool answer honest can silently disable the loop guard that keys on answer equality - found 2026-09-12 in the hub's edit_file fix, which must therefore ship atomically with a re-keying of repeat detection"
metadata:
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T05:36:31.335Z
---

The hub's `edit_file` returns a success string invariant of the outcome, so identical repeated edits each answer `OK`
while corrupting the file. Verified in the kept set G workspaces: 363 `edit_file` calls, 241 identical repeats, 201 of
which wrote again; `s6_graph.py` reached 1987 lines with 28 `def __init__` and 33 `def nodes`; 50 of 100 hidden checks
were on files this corrupted. Two shapes: a `LINES` range whose reported count is arithmetic on the REQUEST (`b-a+1`),
and a `FIND` whose `REPLACE` contains the `FIND` text, so it re-matches forever - and duplicate Python methods are
legal, so no syntax check ever fires.

**The trap.** The repeated-call detector keys on exact ANSWER equality (`const answer = String(result ?? '')`, then
`seenBefore === answer`, confirmed verbatim in source). The moment the answer encodes a line count, two identical calls
produce different answers, `run.repeatCalls` stops incrementing for `edit_file`, and the stuck-run stop stops firing for
the tool that needed it most - in run `33a9d81d` that counter (`repeatCalls: 25`) was the ONLY thing that ever reacted.
So the honesty fix, keying repeat detection on the ARGS instead of the answer, and the duplicate refusal are ONE change.

Also structural, and it explains why the existing duplicate warning never fired: `defNames()` returns a **Set**, so
`lostDefs` cannot see 1 -> 2 at all, and `duplicateDecls.js`'s regexes are anchored at column 0 with the class-method
exemption explicitly pinned by its own test. The string "times at the top level" appears **0 times across all 58 set G
runs** - every duplicate was an indented class or Python method. The existing guards fire on REMOVAL and on
UNPARSEABILITY; set G's corruption was ADDITION of syntactically legal duplicates, exactly the gap between them.

**How to apply:** when making a tool's output more informative, check every consumer that compares outputs for equality -
loop guards, caches, dedupe, replay counters. Ship the re-keying in the same change, and add a test that covers the
mutating tool (the existing `repeatCall.test.mjs` only exercises `read_file`, so it cannot catch this regression).

Related: [[setg-result-budget-is-the-ceiling]], [[silent-failures-are-the-class]],
[[fix-the-deciding-path-not-the-advisory-one]], [[tool-bugs-not-nudges-2026-09-11]].
