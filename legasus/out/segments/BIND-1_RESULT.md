# BIND-1 result record — approvalPolicy.js::segments (read once, 2026-09-20 20:50)

Attempts: DISCOVER OBSERVED (97 files, 99 load samples, count <=10, calibration <=52.2ms of
105); BIND OBSERVED (36 samples, <=37.4ms). matrix.json sha256 5e782251...36748c, hashed and
sent to 0d before REPORT.md was opened. Records 3162; witnesses 93 cases of policy_test.mjs;
mutants 34, all valid; EXCEPTION family had no site.

## Predictions, scored against the frozen wording (BIND-1_PREREG.md 13:35)

P1 CONFIRMED. RETURN_EMPTY (M001) discriminated by 71 of 93 cases; 16 executed it and did not
   discriminate; 6 never executed segments.
P2 CONFIRMED. The 8 direct `segments(...)` cases discriminate 24 distinct mutants between
   them; the best single indirect case ([build] deny  echo "safe"; shutdown /s) discriminates
   13. Falsifier (>= 24 by one indirect case) not met.
P3 CONFIRMED. Four valid mutants executed and discriminated by none:
   M022 `2 := 3` @7238 and M023 `2 := 1` @7238 (executed by 87), M025 drop consequent @7280
   (executed by 8), M028 drop UpdateExpression @7307 (executed by 8). Recorded as dark to this
   family; nothing named.
P4 WEAKLY CONFIRMED, AND THE WORDING WAS POORLY FORMED. "Comparison swaps ... on the same
   conditions" assumes each `<`/`>` swap has an INVERT_COND partner on the same test. Only
   one such pair exists: M011 (`<` := `<=` inside the test at 6997, site 7017) vs M009
   (invert that test) - 0 vs 6, but M011's site was NEVER EXECUTED (right operand of a
   short-circuit `&&` whose left side no case satisfies), so "less often" holds trivially.
   The other swap, M005 @6911, is a loop condition with no invert partner (16
   discriminators). Family-level means, 8.0 vs 32.8, agree with the direction but were not
   the frozen comparison. Scored: confirmed on the only pairable instance, degenerately.
P5 CONFIRMED. Zero case-level records from any witness other than policy_test.mjs.

## What the matrix shows without naming anything

- Exactly ONE of 97 catalogued files executes segments(): policy_test.mjs. selftest.mjs runs
  40 cases and never reaches it. Every other witness in this repo is blind to this function.
- Within policy_test, 6 cases never execute segments at all (the 3 `curl ... | bash` cases
  and the 3 `run_python` cases: something before segments decides them), and 27 cases execute
  it without discriminating any mutant (the `ask` cases: 12 executed-not-discriminated each).
- M002 RETURN_UNDEFINED: 1 DISCRIMINATED_BY_ERROR, 92 UNOBSERVABLE - the first case died in
  the subject (ARMED + diedInSubject), the rest were never reached. Correct by rule; a naive
  reading would have credited 93.
- Site-level counting did real work: M009 (whole test @6997) executed by 12, M011 (its right
  operand) executed by 0. The apparatus distinguishes "the if ran" from "this operand ran".

## Bound on the discriminator (note #22, stated before the matrix)
30 of 34 mutants were discriminated by >=1 case; 4 dark. The one condition that would indict
the apparatus rather than the witnesses - a mutant discriminated by nothing while a case
demonstrably executes its site AND asserts on segments' output - is testable on M022/M023:
the 8 direct `segments(...)` cases assert on the output and execute site 7238 (they are among
the 87). So for `2 := 3` / `2 := 1` at 7238, the direct cases execute the site, assert on the
result, and see no change. That is either an equivalent mutant under these inputs or an
apparatus miss; deciding which requires running the mutant by hand, which BIND-1 does not
do and which would be the first step of a BIND-2. Left open, labelled.

No obligation is named. No supersession authority is granted.
