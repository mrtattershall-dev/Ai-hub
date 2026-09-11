# 14B rerun - is the hub making the 14B better?

**Answer: no measurable change. Hand-graded, 22 -> 21 goals done exactly as asked; implementation
correct 32 -> 31. The three fixes are correct and fired 5 times, and none changed an outcome - the
14B does not act on the extra information they give it.** The scorer claimed 25 -> 33.

Same model (Qwen2.5-Coder-14B-Instruct-AWQ, A10G), same 40 goals (goals-A/B.json byte-identical to
../2026-09-10-14b-vs-32b), same harness and scorer. Only the hub differs (see BASELINE.md):
baseline main 725bf46; rerun main 454814a = + 9afe43a (cut-off reply writes nothing), 95428d9
(duplicate top-level declaration flagged), b59a0c4 (failing Python assert shows both sides).
GPU: deployed 22:54:36, stopped 23:18:53 by stopApp.mjs (exit 0, re-list confirmed). ~$0.45.

## Hand-verified, 40 goals (same categories and rules as the head-to-head README)

| hand-verified, 40 goals | baseline | rerun |
|---|---|---|
| **done exactly as asked** | **22** | **21** |
| correct code, model's own test wrong | 7 | 4 |
| works, but a stated requirement missed | 1 | 5 |
| correct, broken only by an earlier goal's file | 2 | 1 |
| failed | 8 | 9 |
| **implementation correct** (rows 1-4) | **32** | **31** |
| scorer "work" (for comparison) | 25 | 33 |

| # | Set A | base | rerun | | # | Set B | base | rerun |
|---|---|---|---|---|---|---|---|---|
| 1 | temp convert | P | P | | 1 | Queue | P | P |
| 2 | kToC | P | P | | 2 | peek() | P | P |
| 3 | palindrome | P | P | | 3 | anagram | P | P |
| 4 | Inventory | P | P | | 4 | Cart | P | P |
| 5 | remove last unit | P | P | | 5 | round total | P | P |
| 6 | notes (comprehension) | P | P | | 6 | notes (comprehension) | P | P |
| 7 | mergeIntervals | CT | NX (own test now right, export lost) | | 7 | flatten | P | NX |
| 8 | reasoning | F | P | | 8 | reasoning | F | RM (answer right, pinning assert never added) |
| 9 | Enter adds item | P | P | | 9 | sum page | P | P |
| 10 | Clear button | F | F (null button) | | 10 | validation | P | P |
| 11 | stats | CT | CT (mode([]) outside try) | | 11 | wrap | CT | CT (evidence shown, wrong side edited) |
| 12 | router | CT | F (not exported; '/u/:id' matches '/u/7/8') | | 12 | semver | NX | NX |
| 13 | wildcard | F | F (never matches) | | 13 | pre-release | F | F (only the literal example; rc.1 wrong) |
| 14 | bouncing ball | P | P (broken later by 15) | | 14 | WASD + wrap | P | F (moves, never wraps) |
| 15 | paddle | F | F (TDZ crash kills the game) | | 15 | obstacles + Game Over | F | F (updatePlayer undefined) |
| 16 | CSV sum | CT | CT (evidence shown, misread) | | 16 | deep_get | CT | CT (evidence shown, wrong side) |
| 17 | debounce | P | P | | 17 | retry | P | P |
| 18 | test other files | INH | INH (7's missing export) | | 18 | test other files | INH | F (uses mocha describe) |
| 19 | bit functions | F | P | | 19 | Luhn | CT | NX |
| 20 | index | P | P (14 of 15 t-files) | | 20 | index | P | F (never written) |

P done as asked - CT correct code, own test wrong - NX correct, not exported - RM correct, a stated
requirement missed - INH correct, broken by an earlier goal's file - F failed.
Web/game goals were driven in puppeteer with the hub's own launch options (tools/gradeweb.mjs); a
game broken by the NEXT goal was graded as it stood before that goal (git checkpoint), and the
breakage counted against the later goal. Unexported functions were graded by loading the file in
a vm and calling them directly.

## Did the fixes work when they fired? (tools/runmarkers.cjs, tools/evtrail.cjs)

- **Cut-off reply (9afe43a): 0 firings.** The baseline's runaway 7,760-token reply (A19) did not
  recur; A19 passed by ordinary variance.
- **Assert evidence (b59a0c4): 3 goals, 15 firings, values exactly right every time - and the 14B
  edited the wrong side 3 out of 3.** A16: LEFT "'Unknown column: price'" vs RIGHT
  'Unknown column: price' (the quotes are the whole bug) - it called it "case-sensitive" and
  lowercased both sides. B11: its function's ['This is a', 'test'] was CORRECT, its expectation
  wrong - it rewrote the function. B16: function returns None correctly for a path through the
  0 at index 0 - it went to debug the function.
- **Duplicate declaration (95428d9): 2 goals, 7 firings; acted on both times, fixed neither.** A15:
  "Merge the two render functions" - its edit rewrote one render and left the other. B15: tried to
  merge update() twice with a FIND written from memory (every line exists, not contiguously).

So the hub now puts the right facts in front of the 14B, and the 14B does not reason from them.
This is the same "advisory, not mechanical" pattern as before: detection works, correction is the
model's job, and this model does not do it. The remaining gap is in the model, not the hub.

## Two things the scorer gets wrong, both seen again tonight

- **console.assert exits 0.** A12 and B12 printed 9 and 6 "Assertion failed" lines and exited 0,
  so the hub reported a clean run and the scorer said :runs. A candidate hub check: a node run whose
  output contains "Assertion failed" is a failed self-test whatever the exit code.
- **"exporting X".** The scorer checks a function is defined, not exported. The rerun missed the
  export 5 times (A7, A12, B7, B12, B19) against once in the baseline - likely variance, but the
  single biggest category shift.

## Caveat
One pass per hub version; the same 10 goals scored 5/10 and 8/10 on two passes earlier tonight.
A 1-goal difference is noise. What is NOT noise is the mechanism evidence above: each fix fired,
showed the right thing, and the model's next move ignored or misread it.

data/ - both sets' runs, traces and final workspaces. NOTES-live.md - notes in the order found.
