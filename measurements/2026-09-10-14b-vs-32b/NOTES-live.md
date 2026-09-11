# 14B vs 32B head-to-head - live notes (hand verification as results land)

Both Qwen2.5-Coder AWQ int4 (14B A10G, 32B H100), same hub (main 725bf46), identical fresh
prompts (Set A t-goals, Set B u-goals), pre-registered in b504e8d. Identity verified for both.

## Hand checks

14B set A goal 7 (mergeIntervals) - scorer THROWS; IMPLEMENTATION CORRECT. Independent test of
the model's own function: sorted, unsorted, touching ([1,4],[4,5] -> [1,5]), nested and empty
all right. Its assert expects [[1,7],[8,10],[12,16],[15,18]] -> [[1,18]], but [1,7] and [8,10]
do not overlap (7 < 8); the right answer is [[1,7],[8,10],[12,18]]. Correct code, wrong own
test - the 14B's fifth tonight and the first on a fresh prompt set. File as it stood saved to
snapshots/14b-setA-goal7-t4_intervals.js before goal 8 (reasoning) edited it.

14B set A goal 12 (router match) - scorer THROWS (2 tool errors); IMPLEMENTATION CORRECT. Called
the model's own match directly: '/u/:id' vs '/u/7' -> {id:'7'}; mismatch -> null; extra segment
-> null; '/a/:x/b/:y' -> {x:'1',y:'2'}; static paths right. Its TEST is structurally broken: line
29 calls a bare match(...) that is only reachable through the export -> "ReferenceError: match is
not defined" before any assert runs. Sixth correct-code/broken-test case for the 14B tonight (a
new flavour: unbound name, not a wrong value). Saved to snapshots/14b-setA-goal12-t7_router.js
before goal 13 edited it. The 32B's identical goal: done, runs.

Queue for post-run hand checks: 14B g8 (why stopped, no T_INTERVALS.md); g9/g10 both (Enter adds,
Clear empties); 14B g11 (stats: code or test?); g6 both (T_NOTES vs the real class); 32B g8
(reasoning right, for the right reason?); 32B g13 (wildcard really works, old cases intact);
g14/g15 both (bounce on all four walls; paddle).

32B set B goal 2 ("Add peek() to the EXISTING u1_queue.js") - scorer: u1_queue.js:runs
FN-MISSING(peek). VERIFIED TRUE POSITIVE: the word "peek" appears nowhere in u1_queue.js or any
other .js in the workspace; the class has constructor/enqueue/dequeue/size only. The file RUNS,
so the pre-fix scorer would have counted this as work done. First live catch by the FN-MISSING
check (added after 14B goals 19/23 fooled the old scorer) - and it caught the 32B. Snapshot:
snapshots/32b-setB-goal2-u1_queue.js.

## 32B set A - hand verdicts (its set A workspace is final)
g6  T_NOTES   COMPREHENSION PASS: exactly add/count/remove, right args, right throws (count
    returns 0, correctly not listed as throwing); nothing invented.
g8  REASONING PASS - right answer AND right reason: "sorts the intervals before merging, so it
    handles unsorted input" - the code does sort first; independent calls agree
    ([[8,10],[1,3],[2,6]] -> [[1,6],[8,10]]). The 14B tonight got its reasoning goal right with
    a wrong or missing reason - this is the clearest capability gap so far.
g9  PASS: Enter (keypress) and an Add button both append an <li>.
g10 PASS functionally: Clear empties the list (listener on DOMContentLoaded), but the button was
    APPENDED after the page's closing tags - sloppy markup browsers tolerate.
g14 PASS: ball bounces off all four walls, radius-aware.
g16 CORRECT CODE, WRONG OWN TEST: sum_column right (6.0; KeyError on unknown column). Its assert
    compares str(e) to the bare message, but str() of a KeyError QUOTES it - can never match.
    The self-test weakness is NOT unique to the 14B; it is rarer in the 32B.
g18 FAIL via a HUB GAP: read lines 1-5 of t1_temp.js three times; the tool said "Use read_file
    with OFFSET: 6 to continue"; it never did; repetition guard killed the run in 12s. Candidate
    mechanical fix: step a repeated identical read_file to the next window instead of stopping.
g13, g15: pending (checker crashed on g13; g15 paddle collision under check).
g15 FAIL (scorer: parses): no ball-vs-paddle collision anywhere in t8_game.js (no line refers to
    both), so the ball can never bounce off the paddle - the goal's point. The paddle is drawn
    from assets/paddle.png, which does not exist (invisible paddle). It does move on the arrow
    keys, clamped, and drawPaddle/movePaddle are called in the loop.
g13 FAIL (scorer: runs) - wildcard is WRONG, confirmed by running it: a trailing '*' returns a
    match without checking the prefix, so match('/files/*','/other/a') -> {} (must be null) and
    match('/u/:id/*','/u/7/x/y') -> {} (loses id). Original cases still right. Its own tests never
    tried a wrong prefix. ALSO: the final t7_router.js exports nothing, though goal 12 asked for
    it to be "exporting match" - the FN-MISSING check only tests definition, not export
    (history check pending: which goal dropped it).
g12 PARTIAL (scorer: runs): git history of t7_router.js - NONE of its 4 versions ever exported
    match, though the goal said "Create t7_router.js exporting match(...)". The function is
    correct. Mirror image of the 14B on the same goal: the 14B EXPORTED match but its own test
    could not reach it; the 32B's test reaches it but it is not exported. Neither fully met it.

METHOD ADDITION (applies to BOTH models, post-run): FN-MISSING checks a function is DEFINED, not
EXPORTED. For every goal worded "exporting X", load the file with asserts neutralised and
confirm X is in module.exports - graded identically for 14B and 32B.

14B set A goal 19 (t12_bits) - INTERRUPTED, not an outage: first action wrote a 0-BYTE
t12_bits.js; the next reply ran to ~7,760 tokens over 296 s (26 tok/s) and the stream closed
prematurely ("Model stream failed ... Premature close") -> hub marked it interrupted. The app
stayed deployed and healthy (set B re-confirmed identity). A degenerate generation with an infra
symptom - reported both with and without this goal. Small hub gap: write_file accepts EMPTY
content (append_file already refuses it).
14B set A SCORER totals: work 12/20, done 9/20, 14.5 min. (32B set A scorer: 18/20, 15/20.)
Hand verification in progress - both models' scorer numbers will move.

## 14B set A - hand verdicts (its set A workspace is final)
g6  COMPREHENSION PASS: exactly add/remove/count, right args; only remove throws, and it says so.
g8  REASONING FAIL: re-sent the same 106-byte append 3 times -> loop guard; T_INTERVALS.md never
    written. (32B: right answer, right reason.)
g9  PASS: Enter (keydown) appends an <li>.
g10 FAIL - a real difference: the Clear listener is attached at top level, but the button was
    APPENDED after </html>, below the script - at script time getElementById('clearButton') is
    null, the attach throws, Clear never works. Also appended two duplicate <ul id="itemList">.
    (32B wrapped its listener in DOMContentLoaded -> its Clear works.)
g13 FAIL, opposite to the 32B: its wildcard NEVER matches ('/files/*' vs '/files/a/b/c' -> null);
    original cases right. (32B's wildcard over-matched.)
g14 PASS: bounces off all four walls.
g16 CORRECT CODE, WRONG OWN TEST - the IDENTICAL Python trap as the 32B: asserts str(e) of a
    KeyError, which Python quotes, so it can never equal the bare message.
g11, g15, g18: pending (checker fix / per-frame collision / float strictness).
g11 CORRECT CODE, WRONG OWN TEST (14B's 7th tonight): run properly, mean, median (odd and even)
    and mode are all right and all raise ValueError on []. The file dies because its own
    module-level test calls mode([]) outside any try, so the correctly raised error is uncaught.
    (An earlier "NO FN" for median/mode was MY checker cutting the file short - not the model.)
g15 FAIL - CORRECTS my earlier "probably a reversal": the 14B wrote checkCollision() (line 62)
    but NOTHING CALLS IT; the per-frame update() only moves the ball and bounces it off walls.
    So in BOTH models the ball can never hit the paddle (32B: no collision code; 14B: dead code).
g18 COMPREHENSION PASS: t11_check.js uses the REAL exports (cToF, fToC, kToC, mergeIntervals);
    its values are sound (373.15 - 273.15 === 100 exactly in JS). It dies only because requiring
    t4_intervals.js runs goal 7's bad assert at load - an inherited failure.

## "exporting X" check, both models, set A (tools/exportcheck.cjs, identical rules)
  goal 1  cToF,fToC          14B exported | 32B NOT exported
  goal 7  mergeIntervals     both exported
  goal 12 match              14B exported | 32B NOT exported
  goal 17 debounce           both exported
  goal 19 countBits,isPow2   14B NOT (empty, interrupted file) | 32B exported
  goal 4  Inventory class    both export the class. CHECKER CAVEAT: it also wanted the class's
          methods exported separately - wrong for a class goal; both models are fine here.
  => On the explicit "exporting X" instruction the 14B complied more often; the 32B tends to
     write self-contained scripts that never export.

## Set B reasoning goal (8: what does flatten do with { a: [1, 2] }?)
32B PASS: U_FLATTEN.md says { 'a.0': 1, 'a.1': 2 }; its own flatten produces exactly that,
    consistent on nested cases ({a:{b:[1,{c:2}]}} -> a.b.0, a.b.1.c); the file runs clean.
14B: U_FLATTEN.md says { a0: 1, a1: 2 } (no dot - an odd convention for a dotted-keys function);
    the file THROWS "Cannot access 'assert' before initialization" (test uses assert above its
    declaration). Whether the write-up matches its code: under check. Files saved to
    snapshots/14b-setB-goal8-*.
14B set B goal 8 REASONING FAIL, confirmed by running its code: its own flatten turns
    { a: [1, 2] } into { 'a.0': 1, 'a.1': 2 } (keys built as `${parentKey}.${key}`), but its
    U_FLATTEN.md says { a0: 1, a1: 2 } - the write-up contradicts its own code, and its new assert
    would fail even if the file loaded (it dies first on assert-before-declaration). The file
    also self-requires its own module with a "// Remove duplicate declaration" comment - it was
    fighting its own structure. 32B on the identical goal: write-up matches code exactly.

32B DONE: set B scorer work 17/20, done 11/20 (set A 18/20, 15/20). Stopped by the watchdog via
stopApp.mjs at 21:55:01 - exit 0, first attempt, "confirmed by the app list"; independent re-list:
stopped, 0 tasks, 21:55:09. H100 ~22 min (~$1.50).

## 32B set B - hand verdicts (its set B workspace is final)
B2  FAIL: peek never added (verified above).
B3  PASS: are_anagrams right on all pairs incl. spaces/case ('Dormitory'/'Dirty room').
B9  PASS: sum shown.   B10 PASS: empty or NaN input -> error message instead of a sum.
B11 CORRECT CODE, WRONG OWN TEST (32B's 2nd): wrap is right (max line 10, no word split); its
    assert expects "This is\na test" for width 10, but "This is a" is 9 chars and fits.
B13 behaviour PASS ('1.0.0-beta' < '1.0.0'; old cases incl. 2.0.0 vs 10.0.0 intact) - but compare
    is NOT exported though the goal said "exporting compare(a, b)" (32B's 3rd export miss).
B14 PASS: WASD moves the circle; wraps on all four edges.
B16 PASS: deep_get hits, missing keys, out-of-range index, path past a value -> None.
B17 PASS: retry resolves after 2 failures (3 calls); always-failing -> rejects with the LAST error.
B18 COMPREHENSION FAIL: right method names (enqueue/dequeue) but wrong import shape -
    require('./u1_queue.js').Queue while the module does module.exports = Queue (same for
    flatten) -> new Queue() throws.
B6, B15, B19: pending (notes tail; Game Over + per-frame collision; luhn re-check - my first
    luhn/export checks lacked console.assert in the stub, a checker error).
B6  COMPREHENSION PASS: addItem/total/applyDiscount with right args; only applyDiscount throws
    (outside 0-100), and the notes say exactly that.
B19 behaviour PASS: isValidCard right on 4111111111111111 (valid), ...112 (invalid), 79927398713
    (valid), 79927398710 (invalid). NOT exported - the file has no module.exports at all, though
    the goal said "exporting isValidCard(number)" (32B's 4th export miss tonight).
B15 FAIL (scorer: parses) - Game Over can NEVER fire: update() and checkCollisions() are each
    defined twice (appended duplicates; the LAST declaration wins). The winning checkCollisions
    (line 202) tests distance < player.radius + obstacle.radius, but none of the 3 obstacle
    objects has a radius field -> NaN -> always false. The winning update() also bounces
    obstacles off walls with the same missing obstacle.radius, so they never bounce. Code that
    LOOKS complete ("Game Over" string, collision fn, per-frame call) and cannot trigger.

Export check, 32B set B (console stub fixed, no load errors): compare (B12) and isValidCard (B19)
    genuinely NOT exported. Across both sets the 32B missed "exporting X" 4 times (t1, t7_router,
    u7_semver, u12_luhn); the 14B once (t12_bits - the empty, interrupted file).
B15 ALSO REGRESSED B14 in the final file: the winning update() (lines 159-200) calls neither
    wrapPlayer() nor moveObstacles() and has no wrap logic of its own - so goal 14's edge
    wrap-around is gone (B14 passed when written; B15 undid it). Git history: six checkpoints in
    a row "The obstacles array is already declared, so I will..." - the 32B was fighting
    duplicate const declarations, appending/editing in a loop, leaving a duplicated function
    each pass. The SAME failure class the 14B showed tonight (repeated multi-step edits to an
    existing game file) - not a size-specific weakness; the 32B hit it just as hard here.

## 14B set B - hand verdicts (goals 1-16 final; 17-20 were only adding new files)
B3  PASS: are_anagrams right on all pairs (same cases as the 32B).
B6  COMPREHENSION PASS: exact - only applyDiscount throws, outside 0-100.
B9  PASS: sum shown.  B10 PASS: empty input -> error message (parseFloat(x)||0 makes its isNaN
    test dead code, but the trim()==='' check catches empty, which is what a number input gives
    for junk).
B11 CORRECT CODE, WRONG OWN TEST - and the assert is CHARACTER-FOR-CHARACTER the 32B's:
    wrap("This is a test", 10) == "This is\na test" (right answer "This is a\ntest"). Two models
    writing the same wrong expected value = a memorised example, not reasoning.
B16 CORRECT CODE, WRONG OWN TEST: deep_get passes independent cases; its assert uses
    {'a': {'b': [0, {'c': 1}]}} with 'a.b.0.c' - element 0 is the number 0, so the right
    answer is None, not 1.
Exports, 14B set B: Queue, Cart, flatten, retry, isValidCard exported; compare NOT exported
    (14B's 2nd export miss tonight; the 32B also missed compare, and missed isValidCard).
B1/B2, B4/B5, B12/B13, B14/B15: pending (my helper path was wrong - Git Bash /tmp is not
    visible to node on Windows; rerunning via cygpath -w).
B14/B15 FAIL - the SAME failure as the 32B: update() is defined FOUR times (lines 13, 90, 138,
    199); the last declaration wins. The winning update() wraps the player, moves and wraps the
    obstacles (radius defined) and checks collisions -> gameOverMessage - but it never calls
    requestAnimationFrame and draws nothing, and update() is started once (line 76). So the game
    runs ONE frame and freezes; goal 14's working game is undone too.
    BOTH MODELS broke their game identically: appended duplicate function declarations, the last
    silently winning - which node --check cannot catch (duplicate function declarations are
    legal). HUB FIX CANDIDATE (helps both models): after any write/append to a .js, flag a
    top-level function declared more than once in the post-write verdict.

14B DONE: set B scorer work 13/20, done 9/20 (set A 12/20, 9/20). Harness exit 22:01:34.
B1  PASS: queue order 1,2,3; size right; dequeue on empty throws.
B4/B5 PASS: total 0.1x3 -> 0.3 (rounded); applyDiscount(10) -> 0.27; 101 and -1 throw.
B12 behaviour PASS on ordinary versions (incl. 2.0.0 vs 10.0.0) - compare NOT exported.
B13 FAIL - the REVERSE of the usual pattern: pre-release support is BACKWARDS
    ('1.0.0-beta' vs '1.0.0' -> 1, want -1; reversed -> -1, want 1) and the 14B's OWN TEST
    CAUGHT IT (-1 !== 1). Right test, wrong code - the first such case tonight.
B2  under check: my grab found no peek METHOD on Queue, yet FN-MISSING passed (peek defined
    somewhere) - possibly a top-level function outside the class.

14B STOPPED 22:01:43 by the watchdog via stopApp.mjs: exit 0, first attempt; independent re-list
22:02:35: all three coder apps stopped, 0 tasks. (stopApp's reported stoppedAt was the OLDER
same-named app's 21:10:17 - a reporting flaw, told the captain; the stop itself was correct.)
B2  PASS when written, REGRESSED later: git history shows peek added INSIDE the class at e850e81
    ("Now that the peek() method has been added..."); later checkpoints from other goals (closing
    carried-over "add assertions to test the Queue" tasks) rewrote the file without it. The
    FN-MISSING check was right at the time (my suspicion of a false pass was wrong).
B17 PASS: retry resolves after 2 failures (3 calls); always-failing rejects with the last error.
B18 COMPREHENSION PASS, inherited failure: correct import shapes (require('./u1_queue.js') for a
    class exported directly; { flatten } for module.exports = { flatten }) - the 32B got these
    shapes wrong. Dies only because goal 8's broken u4_flatten.js throws at load.
B19 CORRECT CODE, WRONG OWN TEST (14B's 8th tonight): isValidCard right on 4111111111111111,
    ...112, 79927398713, 79927398710; its own "Test case 1" expects the wrong answer.

## Index goals (A20/B20), files listed vs files that exist
  14B A: 14 of 15 (omits only t10_debounce.test.js)   14B B: 14 of 14, complete
  32B A: 13 of 14 (omits only t10_debounce.test.js)   32B B: 6 of 14 - omits 8 files
  Neither model INVENTED a file in any index.
