---
name: contract-derivation-contaminated-treatment
description: "a flat wants[] that discarded method-vs-export ownership was rendered into BOTH the prompt and the checker, so the model was told to export a method, did, and was scored PASS - prompt and evaluator agreed with each other and both disagreed with the goal"
metadata:
  node_type: memory
  type: project
---

2026-09-14. `deriveGate` turned

    "Add delete(key) and clear() to the EXISTING Cache in s7_cache.js"

into `wants = ["Cache","delete","clear"]` - a flat list with ownership thrown away. That same list
was rendered into the PROMPT ("it must export: Cache, delete, clear") **and** used by the checker.
The model obeyed and wrote `function delete(key)` - a SyntaxError, `delete` being reserved.

**This is TREATMENT contamination, not a scoring error.** The apparatus changed what the model
produced, so the affected results are VOID, not understated - you cannot assume contamination was
equal across arms once the instrument alters the treatment. Rerun; do not patch the numbers.

**The error inflated, and there were no false failures at all:**

    published passes: 1,2,3,4,6,7,8,12,13,15,16,20
    corrected passes: 1,2,3,4,6,7,8,12,15,20
    FALSE PASS (scored correct, actually wrong): goals 13, 16     FALSE FAIL: none

Goal 11 is the specimen worth remembering - correct implementation, unimportable file:

    class Library { checkout(isbn, member) {...} available(isbn) {...} }   // correct methods
    module.exports = { Library, checkout, available };                     // ReferenceError at load

**Why:** 7 of 20 goals were add-a-method goals, and a method is never a module-level name, so those
goals were unpassable by construction - while the ones the model "passed" it passed by doing the
wrong thing correctly.

**How to apply:**
  * Never let one heuristic define both the instruction and the evaluator. Emit a typed contract,
    then a SEPARATE human-readable rendering (what a person checks) and prompt rendering (what the
    model is told). Render the contract in English and READ IT before running anything - that step
    caught two further bugs on its first use: prose `"a book (adding"` read as a method named `book`
    (the extractor allowed a space before the paren), and a stopword list silently deleting the
    legitimate method `add`.
  * Represent obligations with ownership: `{moduleExports:[], members:[{owner,kind,name}]}`. Check
    them differently and return a DISTINCT rejection kind per obligation, so repair can be typed on
    the reason instead of on "false".
  * Split failures three ways before drawing conclusions: FALSE_FAIL (evaluator-only - retroactively
    correctable), PROMPT_HARMED (treatment contamination - must be rerun), GENUINE.

See [[checker-branch-that-cannot-fail]] for the two-witness rule the fixtures use, and
[[orchestration-discards-good-work]] for what survived this quarantine: the REACH result, which
never touches the contract.

**The generalisation, and the first question any repair loop must ask:** before "how do I repair this
output?", ask *"am I certain the output is wrong?"* Several times tonight it was not.
