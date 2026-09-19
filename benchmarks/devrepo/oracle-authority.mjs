// GATE 1 + GATE 4 — ORACLE AUTHORITY and SCORING SEMANTICS.
//
// T07 was not a broken task. It was a broken ASSUMPTION, and the assumption was load-bearing everywhere:
//
//     "PRISTINE = TRUTH" ONLY WORKS WHEN THE REQUESTED TRUTH EXISTED IN PRISTINE.
//
// `statistics` has no `midrange`. So the pristine oracle raised AttributeError, a candidate that never
// added it raised AttributeError, they agreed, and REFUSING TO DO THE WORK SCORED IDENTICALLY TO DOING
// IT. An oracle that cannot distinguish success from inaction is not an oracle.
//
// So oracle authority is TYPED, and the type says where truth comes from:
//
//     RESTORE    oracle = pristine behaviour
//     PRESERVE   oracle = pristine behaviour, plus invariants that must not move
//     ADD        oracle = INDEPENDENTLY SPECIFIED new behaviour, PLUS pristine preservation
//     CHANGE     oracle = a delta contract, PLUS preserved pristine behaviour
//
// And outcomes are TYPED too, because `pass = true` collapsed four different things into one:
//
//     REPAIRED    a defect was present and is gone
//     PRESERVED   nothing was required to change, and nothing broke
//     REFUSED     the system declined, and the repository is untouched
//     BROKEN      the final state is worse than the state the task started from
//     UNSCORABLE  the oracle cannot distinguish success from inaction
//
// A REFUSED task is not a solved task, and a PRESERVED task is not a repair. Reporting one number over
// all of them is how a safety result gets mistaken for a capability result.
const NL = String.fromCharCode(10);

export const ORACLE = { RESTORE: 'RESTORE', PRESERVE: 'PRESERVE', ADD: 'ADD', CHANGE: 'CHANGE' };
export const OUTCOME = { REPAIRED: 'REPAIRED', PRESERVED: 'PRESERVED', REFUSED: 'REFUSED',
  BROKEN: 'BROKEN', UNSCORABLE: 'UNSCORABLE' };

// THE ORACLE'S OWN NON-VACUITY CHECK, which is what T07 needed and did not have.
//
// An oracle is admissible only if it can DISTINGUISH the required end state from the starting state. For
// RESTORE and CHANGE that is the mutation biting. For ADD it means the specified new behaviour must be
// observable as ABSENT before the work and PRESENT after - which a pristine-only oracle can never see,
// because pristine does not contain the addition either.
export function oracleAdmissible({ type, distinguishesStartFromRequired, hasIndependentSpec,
  hasPreservationSet }) {
  switch (type) {
    case ORACLE.RESTORE:
      return distinguishesStartFromRequired
        ? { ok: true }
        : { ok: false, why: 'the mutation does not bite, so the oracle cannot tell repaired from untouched' };
    case ORACLE.PRESERVE:
      return hasPreservationSet
        ? { ok: true }
        : { ok: false, why: 'a preservation task needs invariants to check; there are none' };
    case ORACLE.ADD:
      if (!hasIndependentSpec) {
        return { ok: false,
          why: 'an ADD task cannot be scored against pristine alone: pristine lacks the addition, so'
            + ' refusing to add it agrees with the oracle exactly as well as adding it correctly' };
      }
      return hasPreservationSet
        ? { ok: true }
        : { ok: false, why: 'an ADD task also needs the pristine preservation set, or it licenses'
            + ' adding the feature while breaking the module around it' };
    case ORACLE.CHANGE:
      if (!hasIndependentSpec) {
        return { ok: false, why: 'a CHANGE task needs a delta contract; pristine describes the OLD truth' };
      }
      return hasPreservationSet ? { ok: true }
        : { ok: false, why: 'a CHANGE task needs the preserved-behaviour set alongside the delta' };
    default:
      return { ok: false, why: 'unknown oracle type ' + type };
  }
}

// Classify an outcome. Never returns a bare boolean, and refuses to guess.
//
//   startAgrees   did the STARTING state already satisfy the oracle?
//   endAgrees     does the FINAL state satisfy it?
//   committed     did the arm write anything it stands behind?
//   refused       did the arm decline?
export function classify({ oracleOk, startAgrees, endAgrees, committed, refused }) {
  if (!oracleOk) return { outcome: OUTCOME.UNSCORABLE, why: 'the oracle cannot separate success from inaction' };
  if (endAgrees && !startAgrees) return { outcome: OUTCOME.REPAIRED, why: 'a defect was present and is gone' };
  if (endAgrees && startAgrees) {
    return refused
      ? { outcome: OUTCOME.REFUSED, why: 'declined, and nothing required changing - the repository is intact' }
      : { outcome: OUTCOME.PRESERVED, why: 'nothing required changing and nothing broke' };
  }
  if (!endAgrees && startAgrees) {
    return { outcome: OUTCOME.BROKEN, why: 'the final state is worse than the state the task started in' };
  }
  // The defect is still present.
  return refused
    ? { outcome: OUTCOME.REFUSED, why: 'declined; the defect remains and the repository is untouched' }
    : committed
      ? { outcome: OUTCOME.BROKEN, why: 'committed a state that still fails the oracle' }
      : { outcome: OUTCOME.REFUSED, why: 'nothing was committed; the defect remains' };
}

// The only counts that may be reported, and they are kept apart on purpose.
export function tabulate(rows) {
  const t = { REPAIRED: 0, PRESERVED: 0, REFUSED: 0, BROKEN: 0, UNSCORABLE: 0,
    committed: 0, committedCorrect: 0, falseCommits: 0 };
  for (const r of rows) {
    t[r.outcome]++;
    if (r.committed) {
      t.committed++;
      if (r.endAgrees) t.committedCorrect++; else t.falseCommits++;
    }
  }
  t.precision = t.committed ? t.committedCorrect / t.committed : null;
  return t;
}

export { NL };
