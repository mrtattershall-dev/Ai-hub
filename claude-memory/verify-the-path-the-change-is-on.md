---
name: verify-the-path-the-change-is-on
description: "Five undefined-symbol slips in one session (2026-09-12), three of them 'verified' by a check that structurally could not reach the broken line - run the path the change is ON, untruncated"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T06:40:50.297Z
---

Five times in one session I referenced a symbol I had not imported or declared:
`existsSync` in `regress.mjs`, `fileHistorySince` in `agent.js`, `UNVERIFIED` and then `noVerdict` in `tochat.mjs`, and
`UNVERIFIED` again in `runIndex.mjs` (that one I committed). Every one came from editing a fragment without re-reading
its scope. Two were worse than a crash:

- `fileHistorySince` sat inside `try { ... } catch { /* never let the repair take the run down */ }`, so the
  ReferenceError would have been **swallowed** and the fix would have "passed" by never executing.
- `UNVERIFIED` in `runIndex.mjs` reached me as green because `verdictOf()` short-circuits when a row has no
  `finishKind` (all existing rows do), and I piped the run through `head -6`, which cut off the totals line - the one
  place the symbol is actually evaluated.

**Why:** a check that structurally cannot reach the changed line proves nothing, and it *feels* like verification. Three
of the five were "verified" that way. `node --check` is no help either: these all parse.

**How to apply:** after removing, renaming or moving a symbol, grep for every remaining use, then run the code path that
uses it - not a neighbouring path - and do NOT pipe through `head`/`tail` in a way that can hide the end. For a module
with several entry points (`--trend`, `--errors`, default), run each. When a symbol is used inside a `catch`-wrapped
block, force the block to execute in a test rather than trusting a smoke run. And treat "I verified it" as a claim that
needs its own evidence: name which invocation exercised the line.

Related: [[baseline-consumers-before-changing-shared-code]], [[silent-failures-are-the-class]],
[[fixture-blocked-by-another-guard]], [[windows-bash-edit-gotchas]].
