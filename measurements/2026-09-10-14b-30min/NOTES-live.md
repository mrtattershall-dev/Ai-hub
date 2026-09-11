# 14B 30-minute data run - live notes (written during the run)

Model: Qwen/Qwen2.5-Coder-14B-Instruct-AWQ, A10G, lora null (health verified). Hub: main f46e38b.
Harness: scratchpad trial35.mjs, goals.json (25 fresh s-goals), isolated hub, traces in-folder.

## Per-goal observations (verified by hand, not just the scorer)

1  s1_stack.js  stopped  - class CORRECT; the model's own appended test was wrong (try/assert
   pattern failed), then it repeated the same edit 3x -> loop guard. Correct code, bad self-check.
2  s1_stack.js  stopped  - appended clear()/isEmpty() AFTER the class's closing brace (file-scope
   methods -> SyntaxError). main gives append_file NO syntax verdict, so the model only learned
   from `node` crashing; then 2 FIND misses -> loop guard. End-of-run rollback WORKED on real 14B
   output: "s1_stack.js did not parse at the end of the run - restored the last committed
   version that did." => real-model evidence for the append-syntax branch.
3  s2_dates.js  stopped  - works (0 tool errors).
4  s2_dates.js  stopped  - surgical edit works (0 tool errors).
5  S_NOTES.md   stopped  - COMPREHENSION PASS: documented exactly the real methods, did NOT
   invent clear() (rolled back in goal 2), throws correct incl. goal 4's malformed-date throw.
6  s3_words.py  stopped  - word_count CORRECT; its own assert miscounts ("test" appears 3x, model
   expected 2). Second correct-code/wrong-test case in six goals.
7  s3_words.py  stopped  - still throws on goal 6's assert (runs first in __main__).
8  s4_queue.js  stopped  - works; 30 steps / 18 calls / 1 error - recovered rather than one-shot.
   Also: during goals 6-8 the model FIXED goal 1's broken s1_stack.js test via the carried-over
   task ledger (s1_stack.js now exits 0).
9  REASONING    done     - reasoning CORRECT (push appends then sorts; JS sort is stable, so equal
   priorities keep insertion order; independent check popped z,a,b,c,d), and it added an assert
   that proves it. BUT S_QUEUE.md was never written although its own PLAN listed it under FILES.
   It closed a carried-over GOAL-1 task with task_done, the ledger answered "ALL 3 TASKS FOR THIS
   GOAL ARE COMPLETE - verify, then finish", and the finish gate accepted. A FALSE done.
10 s5 web page  done     - clean: wrote page + script, test_web clicked (counter 0 -> 1, no
   errors), verified, finished.

## Hub gaps found by this run (candidates for offline fixes, not fixed yet)
- append_file gets no post-write syntax check on main (fix exists: branch append-syntax).
- The finish gate does not check that files the plan/goal names were actually written (goal 9).
- The ledger counts a CARRIED-OVER task toward "tasks for this goal" (goal 9).

## Model-side pattern (not a hub bug)
- Correct implementation, wrong self-written assert: goals 1 and 6. Scoring "runs cleanly"
  undercounts the 14B; report implementation-correct separately.

## Goals 11-19 (verified by hand where the scorer could mislead)
11 s5 reset button  done  - clean, 0 errors.
12 s6_matrix.js     done  - clean, 3 calls.
13 s6 identity(n)   done  - clean edit to an existing file.
14 s7_roman.py      done  - clean; first Python goal whose own asserts were ALSO right.
15 s8_cache.js      stopped - works on disk (2 tool errors, 75s) - messy run, correct result.
16 s9_validate.js   done  - clean.
17 s10 json+loader  done  - clean.
18 s11_bank.js      done  - works; left IDENTICAL duplicate deposit/withdraw in the class (harmless,
   later definition == earlier) - a cosmetic wart the scorer cannot see.
19 transfer()       stopped - FAILED: transfer was never added. Three edit_file inserts anchored on
   `class Account {` each broke the file; the syntax check flagged it each time; the model re-sent
   the same edit -> loop guard. The rollback restored goal 18's file ("did not parse at the end of
   the run - restored the last committed version that did") - second real-14B rollback save.
   SCORER WEAKNESS: it reported "s11_bank.js:runs" because the file named in the goal runs; it
   never checks the requested FUNCTION exists. Goal 19 counted as a failure here.

Running tally (hand-verified): correct work on disk 13/19; clean `done` 11 of the last 11 web/JS
goals except 15 and 19; false done 1 (goal 9, missing S_QUEUE.md); rollback saves 2 (goals 2, 19).
20 s12_grid.py      stopped - neighbors() CORRECT (hand-checked corner/edge/middle); its own assert
   expects [(0,1),(1,0)] for the corner, the function returns the same cells in its direction
   order [(1,0),(0,1)]. The goal never specified an order. The model PRINTED that result to
   debug it and still did not fix the assert. Third correct-code/wrong-test case (1, 6, 20).
   Implementation-correct count: 14/20 (goal 20 counted correct; scorer says THROWS).
21 s13 canvas game  stopped - CORRECT as written (read by hand; no live browser check from the
   harness): arrow keys set/clear flags on keydown/keyup; all four edges clamped, right/bottom
   against canvas size MINUS the square (the usual miss); real requestAnimationFrame loop.
   Cosmetic wart: render() draws the same rect 3x - same repeated-insertion habit as goal 18.
22 s13 coin + score (in flight at 20:53) - has APPENDED a second render() and a second top-level
   `let score = 0;` - a duplicate `let` is an early SyntaxError, so the file no longer parses.
   Third live instance of the append gap (goals 2, 19-via-edit, 22).
   CORRECTION to 22 (final state, 20:55): the "no longer parses" above was a MID-RUN snapshot.
   Goal 22 FAILED: four append_file calls; after the 2nd the file no longer parsed, main gave no
   syntax verdict, the model re-sent the same 256-byte append -> loop guard. The end-of-run
   rollback restored the last parsing version (after its first 317-byte append), so the file
   PARSES but has a `Score:` label that never increments and NO coin. Third real-14B rollback
   save (goals 2, 19, 22); the strongest real-model case for the append-syntax fix, which would
   have told the model at append #2. Scorer said "s13_game.js:parses".
24 s16_events.js    stopped - EventEmitter CORRECT, including the goal's key requirement: off()
   removed exactly the given listener (its own debug print: "Before off: 2 / After off: 1").
   The TEST is wrong: it reuses one emitter, so the anonymous listener from the first test is
   still attached and sets called=true on emit - the assert then blames off(). Fourth
   correct-code/wrong-test case (1, 6, 20, 24).

## Environment flake, not model or hub: exit 127 at startup (3 sightings tonight)
- fuzz campaign A (earlier), apiErrors (printed its header, then 127), supervisorTick (0 bytes,
  1s). Every rerun passed. All three were under heavy concurrent process load. Two shapes -
  node started vs no output at all - so likely process launch/teardown on Windows, not test code.
23 s14_sort.js      stopped - PARTIAL FAIL hidden by the scorer ("runs"): exports mergeSort and a
   helper merge, but NO quickSort, which the goal required. Third scorer-hidden failure (19, 22, 23).
25 s15_extra_test   stopped - THROWS; pending hand check (test of s4/s9 written by the model).

## Pass 1 summary (harness, 20:35:15 -> 20:57:25, all 25 goals ran - window never closed)
Scorer: done 9/25 | WORK ACTUALLY DONE 16/25 | tool errors 8.
Hand-verified corrections: scorer said "works" but the goal FAILED -> 19 (no transfer), 22 (no
coin; rolled back), 23 (no quickSort). Scorer said THROWS but the implementation is CORRECT and
only the model's own assert is wrong -> 1, 6, 20, 24. False done -> 9 (S_QUEUE.md missing).

Pass 2 (same goals, fresh workspace, warm endpoint) started ~20:58 to use the rest of the
authorized 30 minutes; no new goals after 21:03; app stop 21:05 by watchdog.
25 s15_extra_test   stopped - COMPREHENSION FAIL (hand-checked): tests an API that does not exist -
   queue.enqueue/dequeue/size (real: push/pop/isEmpty), validate.email/validate.url (real:
   isEmail/isStrongPassword; no url validator) - and uses mocha's describe/it in a file run with
   plain node ("describe is not defined"). It never read the files it was testing.
   Contrast goal 5: asked to DESCRIBE files it was exact; asked to TEST them it wrote from memory.

## Comprehension / reasoning / correct-code verdict (pass 1, hand-verified)
- Comprehension: 1 pass (goal 5, exact, nothing invented), 1 fail (goal 25, invented API).
- Reasoning: correct (goal 9, stability of pop() - right answer, proved by an assert), but the
  written explanation it planned was never produced (false done).
- Correct code: implementations right in most goals; the dominant failure is the model's OWN
  tests (1, 6, 20, 24 wrong asserts; 25 invented API), plus three incomplete features the
  scorer called "works" (19, 22, 23).

## Pass 2 (same goals, fresh workspace) - hand checks so far
9  REASONING (pass 2) done - S_QUEUE.md WRITTEN this time (pass 1 skipped it). Verdict "stable" is
   RIGHT (independent check popped z,a,b,c,d) but the stated cause is WRONG: it credits shift()
   with "maintaining the order of insertion"; shift() only takes the first element - stability
   comes from Array.prototype.sort being stable, so equal priorities keep insertion order after
   each push re-sorts. Right conclusion, misattributed reason.
   Across both passes: the 14B reaches the correct answer both times; it explains it correctly
   0 times out of the 1 time it explains it at all.

## Pass 2 summary (harness, ~20:58 -> 21:03:23, window closed after 10 goals)
Scorer: done 6/10 | WORK ACTUALLY DONE 8/10 | tool errors 0. Same goals as pass 1's first ten:
pass 1 scored 5/10 work and 2/10 done on those ten; pass 2 scored 8/10 and 6/10 - run-to-run
variance on identical prompts is large, so one pass is not a stable measurement of the 14B.
Goal 6 (s3_words.py) failed again on its own test in pass 2 as in pass 1.

## GPU window and stop
Endpoint identity verified both passes: Qwen/Qwen2.5-Coder-14B-Instruct-AWQ, A10G, lora null.
Stop overran ~5 min: `modal app stop` prompts [y/N] and aborts non-interactively; the watchdog
used the same command. Stopped with --yes 21:10:10, confirmed `stopped, 0 tasks` 21:10:43.

## Data kept (for the replay corpus / future training)
data/pass1 (25 runs) + data/pass2 (10 runs): runs/, traces/, index.jsonl, workspace/ (no .git),
corpus-rows.jsonl. 190 new unique replies tagged model=coder14b, source=...-pass1/-pass2,
appended to server/testdata/model-corpus.jsonl (1759 -> 1949). Parser threw on 0 of them;
parserCorpus, parseActions, lineNumberStrip, mockLoop, fuzzInvariants all green on the result.
Hub code under test: main f46e38b. (append-syntax, c2218f9, landed after - not in this data.)
