---
name: fixture-blocked-by-another-guard
description: "A reproduction whose fixture is stopped by a DIFFERENT protection never reaches the code under test and reports green forever - caught 2026-09-12 when the destructive-write guard blocked the rollback fixture"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T05:36:17.339Z
---

`rollbackBounded.test.mjs` was written to pin that the end-of-run repair must not reach back past the goal it is
repairing. Its fixture wrote a file that dropped `render()`'s body **and** `module.exports`. That write is REFUSED by
the destructive-write guard (one of my own earlier fixes), so nothing broken ever reached disk, the repair never ran at
all (`rolledBack` undefined across four goals), and cases like "a broken file is not left broken" passed because the
damage never landed. Four goals of green, measuring nothing.

The fix was a write that breaks parsing while keeping every definition and the export - add a new malformed function -
which the guard allows through. Only then did the repair fire, and both real defects appeared at once: `HEAD:r.js` held
the broken version, disk held the pre-goal version, and `git status --porcelain` read ` M r.js` (uncommitted, so the
next goal's checkpoint absorbs and mis-attributes it).

**Why:** the more protections a system has, the more likely a new fixture trips an older one before reaching the target.
The failure is silent and looks like success, which is the same class as the bugs being hunted.

**How to apply:** before trusting any red-first reproduction, prove the code under test actually RAN - a state field it
sets, a string only it emits. If the fixture cannot show that, it is measuring nothing regardless of what it reports. A
probe that prints real state after each step is cheaper than reasoning about it; I guessed wrong about checkpoint
ordering twice before measuring. Corollary already recorded separately: a `(known)` case that starts passing after a
fixture change is a warning, not a win - my fixture commit made one pass by coincidence because the restored bytes
equalled HEAD.

Related: [[silent-failures-are-the-class]], [[advisory-vs-mechanical-recovery]],
[[fix-the-deciding-path-not-the-advisory-one]], [[windows-bash-edit-gotchas]].
