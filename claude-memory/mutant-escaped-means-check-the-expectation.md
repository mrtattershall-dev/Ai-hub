---
name: mutant-escaped-means-check-the-expectation
description: "A mutant reading ESCAPED can mean the expectation list was wrong, not the test - probe the mutated code directly to find the fixture that isolates the rule"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-22T10:01:52.939Z
---

When a mutation-test harness says a mutant ESCAPED, there are two possibilities and they need different fixes:
the test really is blind to the change, or **the predicted list of which tests should fail was wrong**.

2026-09-11, hub parser fixes: two mutants read ESCAPED while the tests were actually fine. The expectation lists
named fixtures the mutated rule never reaches - a comment-prefixed `REMOVE:` and a mid-line `OCCURRENCE:` are caught
by the *anchoring* rule, not by the "read fields outside fenced blocks" rule, and a prose `LINES:` case is caught by
the whole-file-rewrite conversion before any line range is read.

**Why:** when two rules overlap, a fixture passes under either one, so it cannot pin either. Only a fixture that
exactly one rule protects can detect that rule being disabled.

**How to apply:** run the *mutated* code against the fixtures and diff its output against the unmutated run.
Whatever does NOT change is what the test is failing to pin; construct a fixture where only the mutated rule stands
between input and output. Doing this found a shape nobody had tested - prose `LINES: 10-14` alongside a real
FIND/REPLACE pair, which silently turns a two-line surgical edit into a fourteen-line deletion. That is a more
dangerous bug than the one the mutant was written for, and it surfaced only because a mutant escaped.

**Second instance, 2026-09-22 (Set G trial scorer):** `trialG.mjs` derives "functions the goal asked for" with
`\b(\w+)\s*\(` over the goal TEXT, then reports `FN-MISSING(...)` for any not defined. Goal 1's prose contains
"copies of a **book (**adding an isbn…" and "the library **owns (**0 for an unknown isbn)". Both are prose
parentheses, not calls. The scorer reported `FN-MISSING(book,owns)` for a goal whose behavioural check PASSED at the
same state. The disagreement was entirely in the expectation, not the code. Before treating a name-based verdict as
a regression, read the goal text around each flagged name.

Related: [[tool-bugs-not-nudges-2026-09-11]], [[hub-destroys-a-third-of-working-code]].
