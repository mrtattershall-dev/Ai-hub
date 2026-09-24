# Why completed calls still produce mostly unfixed code — from CHECK-1's traces alone

2026-09-24. No model calls, no code changes. Source: the six CHECK-1 run records, step
traces and transcripts, against the frozen checks' case lists. Six runs is a small sample;
these are the obstacles evidenced in it, not a taxonomy.

## The pattern, task by task

**lcs_length (came closest: edited, model-tests passed, requested still FAIL).** The model
tested exactly **2 of the 9** upstream cases ('witch/sandwich', 'meow/homeowner'), both passed
after its edit, and it declared the function fixed. The requested check runs all 9; at least
one other case still fails. Its finish summary asserts a fix its own evidence never covered.

**lis (never edited).** It read the file, ran **one** hand-picked case, got `2` (the correct
answer is 3 — the observed output *was the bug demonstrating itself*), and then re-ran the
identical test twice more until the repeat guard stopped it. The failing observation produced
no diagnosis and no edit: it did not compare the output against an expected value, so a wrong
answer looked like an answer.

**pascal (edited the wrong thing, twice).** `pascal(5)` raised an IndexError at line 8. Both
edits toggled a token **on the line named in the traceback** (`else 0` → `else 1` → back to
`else 0`), re-ran, same traceback, then repeated the test until stopped. The actual defect is
the loop bound on a *different* line (`range(0, r)` → `range(0, r + 1)`); line 8 is only where
the consequence surfaces. The edit target was chosen by stack-trace location, not by cause.

**The one success (is_valid_parenthesization, RETAIN)** is the exception that marks the rule:
it ran **doctest over the whole module** — a suite, not a hand-picked case — and its pass
actually covered the requested behaviour.

(The two RESTORED runs are the same pattern with damage: find_in_sorted made 39 edits with
single-case feedback and broke a protected case; seq-1-count edited once and broke `total`.)

## The obstacle, named

**Verification narrowness, then location-guided edits.** Concretely, two habits:

1. **The model samples one or two cases and treats them as the task.** When they pass, it
   finishes (lcs_length); when the single case fails *without an exception*, it has no
   expected value to compare against, so it repeats the observation instead of diagnosing
   (lis). It never ran the task's own test data, although every seed ships with it —
   `json_testcases` sits in the workspace.
2. **When there IS an exception, the edit goes to the line in the traceback**, not to the
   cause upstream of it (pascal). Constants get toggled at the crash site; loop bounds one
   line away stay untouched.

This sits AFTER the transitions the recent repairs fixed: these runs read the supplied file,
acted, edited, tested, and their calls completed. The remaining gap is between "my test
passed" and "the required behaviour holds" — which is precisely the gap the model's
self-verification was already known not to close (model-self-verification-gap), now located
at case-selection rather than at test-writing.

## What would bear on it (recorded, NOT built — infrastructure is frozen)

- The task guidance already says to run relevant checks; it does not say the test DATA is in
  the workspace. Naming `json_testcases` in the goal (task definition, not hub code) is the
  smallest workflow probe consistent with "the model runs the whole suite, not two cases".
- BENCH-3's three replicates will show whether lcs_length-style near-misses recur at the same
  place — same-task variance is the cheapest evidence on whether case-sampling is stable
  behaviour or noise.

No claim that fixing this raises scores; that would need a live comparison.
