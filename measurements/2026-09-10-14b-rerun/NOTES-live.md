# 14B rerun - live notes (hand verification, written as results arrive)

## Set A - scorer said 12 -> 17 "work" (+5, 0 regressions). Hand-graded, it is about +1.

Workspace: %TEMP%/trial35-GdMRmY. Fix-message counts from the run files (runmarkers.cjs):
CUT OFF 0 goals; duplicate-declaration flag 1 goal (g15, 4 times); assert evidence 1 goal (g16, 9 times).
NONE of the five flipped goals saw any fix message - every flip is ordinary variance.

  g7  t4_intervals  scorer fail->WORK. Implementation correct AND its asserts are right this time
                    (baseline: correct code, wrong own test). But mergeIntervals is NOT EXPORTED
                    (exportcheck.cjs) though the goal says "exporting". Correct, not as asked.
  g8  reasoning     scorer fail->WORK. Right answer + right reason (it sorts first) - but so was the
                    baseline (scored fail only because g7's bad assert ran at load). Not a real flip.
                    Its written evidence tests an already-sorted list while claiming "unsorted".
  g12 t7_router     scorer fail->WORK = FALSE POSITIVE. match is not exported (module.exports = {}),
                    and match('/u/:id','/u/7/8') -> {"id":"7"} (must be null). Baseline got that
                    case right. Its own tests use console.assert, which prints "Assertion failed"
                    and exits 0, so neither the hub nor the scorer sees 10 failing tests.
  g13 wildcard      scorer fail->WORK = FALSE POSITIVE. '/files/*' vs '/files/a/b' -> null; the
                    trailing '*' matches nothing. Wrong.
  g19 t12_bits      scorer fail->WORK = REAL. Exported, all values right (1023 -> 10 bits, 0 not a
                    power of two). Baseline was the runaway 7,760-token reply; it simply did not
                    recur, so the CUT OFF fix had nothing to do.

## Did the fixes help when they fired?

  ASSERT EVIDENCE fired correctly both times it was needed, and the 14B misread it both times.
    g16 t9_csvsum.py: LEFT str(e) -> "'Unknown column: price'" / RIGHT 'Unknown column: price'.
        The quotes are the whole story (str(KeyError) adds them). The 14B said "case-sensitive",
        lowercased both sides, got the same evidence back twice more, never looked at the quotes.
    B u6_wrap.py: LEFT wrap("This is a test", 10) -> ['This is a', 'test'] (CORRECT: 9 chars) /
        RIGHT ['This is', 'a test'] (the model's wrong expectation). It rewrote the FUNCTION.
    => the value is now in front of the model; the 14B does not reason from it. Advisory again.

  DUPLICATE FLAG fired on g15 (t8_game paddle) and the 14B acted on it ("Merge the two render
    functions") - but its edit_file rewrote the FIRST render and left the second, so the flag
    fired again (4x). The game then died on "Cannot access 'paddle' before initialization", and
    its collision check was appended at top level (runs once at load, never per frame).

## New gap seen twice tonight: console.assert failures exit 0
  t7_router.js prints ten "Assertion failed: Test N failed" lines and exits 0. The hub reports a
  clean run; the scorer says :runs. Candidate hub check: a run whose output contains Node's
  "Assertion failed" line is a failed self-test, whatever the exit code.
