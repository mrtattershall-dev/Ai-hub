// NON-VACUITY — a null result is meaningful only after proving the observation actually happened.
//
// THE INCIDENT THIS EXISTS FOR. The set family's leak checker reported **ZERO LEAKS** while every one of
// its evaluations threw. The recorded guard was stored without its `if` and colon, so each generated
// probe program was a syntax error, the result was null, a `continue` skipped it, and every transaction
// fell into the "all correct" bucket by default. The output was indistinguishable from success and said
// exactly what I was hoping to read.
//
//     ABSENCE OF OBSERVED FAILURE IS MEANINGFUL ONLY AFTER PROVING THE OBSERVATION OCCURRED.
//
// So every instrument in this project that can report `0 failures`, `0 leaks`, `0 violations` or `100%`
// carries an observation count and a failed-observation count, and REFUSES TO REPORT A NULL when the
// observation was not actually made. A vacuous pass is worse than a loud error: the error gets fixed.
//
// The distinction the API forces:
//
//     attempted   how many things we set out to examine
//     observed    how many we actually succeeded in examining
//     failed      how many could not be examined at all
//     findings    how many of the observed ones were bad
//
// `findings === 0` is a RESULT only when `observed === attempted` and `failed === 0`. Otherwise it is a
// refusal, and the refusal names the gap.
const NL = String.fromCharCode(10);

export function makeTally(label) {
  return { label, attempted: 0, observed: 0, failed: 0, findings: 0, failureNotes: [] };
}

// Record one examination that succeeded.
export function observed(t) { t.attempted++; t.observed++; return t; }

// Record one examination that could NOT be made. This is the call that stops a vacuous pass.
export function unobservable(t, note) {
  t.attempted++; t.failed++;
  if (note && t.failureNotes.length < 20) t.failureNotes.push(String(note));
  return t;
}

export function finding(t) { t.findings++; return t; }

// Is a null result from this tally meaningful?
export function nonVacuous(t) {
  if (!t || typeof t.attempted !== 'number') {
    return { ok: false, why: 'no tally was kept, so nothing can be concluded' };
  }
  if (t.attempted === 0) {
    return { ok: false, why: 'nothing was attempted, so a clean result is vacuous' };
  }
  if (t.failed > 0) {
    return { ok: false,
      why: t.failed + ' of ' + t.attempted + ' examinations could not be made, so "no findings" is'
        + ' indistinguishable from "nothing was checked"' };
  }
  if (t.observed !== t.attempted) {
    return { ok: false,
      why: 'observed ' + t.observed + ' of ' + t.attempted + ' attempted, and the difference is'
        + ' unaccounted for' };
  }
  return { ok: true };
}

// The line every such instrument prints BEFORE its conclusion. Coverage first, conclusion second - the
// other order invites reading a clean number before checking whether it could have been dirty.
export function coverageLine(t) {
  return '  COVERAGE (' + t.label + '): attempted ' + t.attempted
    + '   observed ' + t.observed + '   unobservable ' + t.failed
    + '   findings ' + t.findings;
}

// Render the conclusion, or the refusal. Returns { ok, text } rather than printing, so callers can decide
// their own exit behaviour and tests can assert on it.
export function conclude(t, { clean, dirty }) {
  const v = nonVacuous(t);
  if (!v.ok) {
    return { ok: false, vacuous: true,
      text: coverageLine(t) + NL + '  REFUSING TO REPORT: ' + v.why
        + (t.failureNotes.length ? NL + '    ' + t.failureNotes.slice(0, 8).join(NL + '    ') : '') };
  }
  return { ok: true, vacuous: false,
    text: coverageLine(t) + NL + '  ' + (t.findings === 0 ? clean : dirty(t.findings)) };
}

export { NL };
