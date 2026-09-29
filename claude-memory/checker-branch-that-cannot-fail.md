---
name: checker-branch-that-cannot-fail
description: "a checker branch with no reachable failure - `return {ok:true}` for unhandled types, and `[].every()` on an empty requirement list - gave a broken artifact a full-chain pass; find branches that cannot fail before trusting any score"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-14T06:37:41.632Z
---

2026-09-14, re-scoring the specialisation-at-fixed-scale run. Two lines conspired to hand goal 9 a
clean pass on a deliverable that cannot work:

    if (lang === 'md' || lang === 'web') return { ok: true, names: [] };   // load check
    contract = wants.every((w) => lc.names.includes(w));                   // wants was []

`deriveGate` returns no exports for an HTML goal, and **`[].every(...)` is `true`**. So the html
branch handed back `ok:true` unconditionally, and the contract test was vacuously satisfied. The
artifact it credited — `s9_board.html` — contains `<script src="s9_board.js">` for a file the model
never wrote, and is missing the `s9-card` class the goal required. It scored `SPELC`, the maximum.

**This is not the lenient-proof failure ([[lenient-proof-easy-input]]), where a real check is fed an
input too easy to expose the defect. Here there is no check at all — the branch has no reachable
failure path.** Same for `if (!refs.length) return ok` shapes and `every`/`all` over any list that
can be empty.

**Why:** every published number is a count of what the checker *could* have rejected. A branch that
cannot fail silently converts "not measured" into "passed", and it does so precisely for the cases
the checker was never taught to handle — which are the cases most likely to be wrong.

**How to apply:** before trusting a scoreboard, for every endpoint ask *what input makes this
FALSE?* If there isn't one, it is not an endpoint. Concretely:
  * grep the checker for `return { ok: true` and for `.every(`/`.all(` and check the list is
    non-empty by construction;
  * make the empty-requirement case an explicit error or a type-specific structural check, never a
    silent pass;
  * pin it with a control suite that asserts the checker REJECTS the real artifact that previously
    passed and ACCEPTS a hand-written correct one.

The control suite is not optional here: my first replacement html check demanded every quoted token
in the goal text be an `id`, which **rejected a hand-written correct page** because `s9-card` is a
`class` in the goal (`<li class="s9-card">`). The positive control caught it in one run. A checker
tightened without a positive control trades free passes for false failures — the number moves, and
it is still wrong.

**Three more instrument defects found in the same workspace dump, each of which moved a number:**
  * **Shared workspace across arms.** Both models wrote into one directory; the second overwrote the
    first, so the losing arm's artifacts were gone by analysis time. One workspace per arm.
  * **Raw replies discarded.** The runner kept `reply.length`. The five short failures could not be
    inspected at all. Write the reply to disk BEFORE scoring it — see [[gate-prompt-suppressor]].
  * **Wrong path scored as silence.** A model wrote goal 5's `evaluate` to `script.js` — 6,220 bytes
    of real work — and `existsSync(lead)` scored it as if it had produced nothing. Path
    non-compliance and producing nothing are different failures and must be counted separately.

**The rule this generalises to, and it is the reusable part:** every negative assertion needs a
demonstrated FAILURE witness; every tightened checker needs a demonstrated POSITIVE witness.

    known-bad  -> must fail
    known-good -> must pass

This is stronger than "write stricter tests", because it names two separate obligations and each one
catches a defect the other cannot. The `[].every()` and unhandled-type `ok:true` bugs violated the
first. The s9-card id/class mistake - rejecting a hand-written CORRECT page - violated the second.
Either control alone would have shipped one of them.
