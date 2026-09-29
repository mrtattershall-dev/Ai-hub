---
name: lenient-proof-easy-input
description: "A checker passes because it only tried the input that cannot expose the defect - happened THREE times in one file on 2026-09-13, each time producing a clean 12/12 over genuinely broken code"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-13T09:18:22.990Z
---

Three proofs in `server/gateLoop.mjs` each returned a clean **12/12 while the code was wrong**, and all
three failed the same way: the proof only ever exercised the input that could not expose the defect.

- **Level 1** called `add(2,3)` and nothing else. 12/12 - while EVERY ONE of those twelve files had grown
  `if (typeof a !== "number") throw new TypeError(...)`, a guard the goal never asked for. `add("2","3")`
  throws in all twelve. Fixed by asserting the guard's ABSENCE (exit 8, `UNASKED`).
- **Level 2** tested `copies = 0` and `copies = 2`. A model writing `typeof c !== "number" || c <= 0`
  passes that and still accepts **2.5**, which the goal ("positive integer") forbids. Fixed by testing 2.5.
- **Level 3** pushed 1 and 2. It could not see `push(x) { this.items.push(Number.isInteger(x) ? x :
  Number.parseInt(x)) }` - integers pass that ternary untouched, so a string silently became NaN. Fixed by
  requiring `push("hello")` to round-trip.

**Why:** a pass rate is only ever as strong as the hardest input the checker tried. Easy inputs confirm the
happy path and say nothing about the defect. This is the same family as
[[silent-failures-are-the-class]] and [[measure-the-thing-itself]], but the mechanism is specific and
worth its own name: the checker was not broken, it was UNDER-EXERCISED, so it reported honestly about a
question too weak to matter. It is also why a clean score should raise suspicion rather than confidence
when the score is suspiciously round.

**Wrong in BOTH directions is normal.** The same session produced a false 0/5 from a too-narrow export
criterion (demanded `module.exports = { add }`, rejected valid `module.exports = function add`) and a
false 5/5 from a too-lenient integer check. Tightening carries its own risk: a false failure blocks
correct work and teaches the model to fight the gate, which is worse than a miss in that one respect. So
narrow each claim to the defect actually OBSERVED, never to a stricter rule the goal does not state.

**How to apply:** for every checker, name the defect it must catch, feed it the input that exposes that
defect, then RUN the mutant and confirm the checker FAILS. Executed 2026-09-13 against all three rungs:
8/8 - each proof accepted correct code and rejected the exact defect it was tightened against (`NOEXPORT`
/ `WRONG` / `UNASKED` / `NOTINT` / `MANGLED`). Extract the checker from its source rather than retyping
it, or the control tests a lookalike instead of the thing that produced the numbers. Related:
[[mutant-escaped-means-check-the-expectation]], [[baseline-consumers-before-changing-shared-code]],
[[protocol-not-capability-ceiling]].
