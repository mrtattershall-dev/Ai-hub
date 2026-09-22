// THE PRESERVED SPECIMEN — test support only. No production module imports this file.
//
// This is the pre-containment continuity resolver, its body moved here unchanged. It attaches an
// authorized continuity to the WRONG one of two byte-identical histories when the merger assigns
// origins by position (P2). It is kept because a failure repaired everywhere stops being evidence,
// and the P-suite injects it so those arms still measure the failure end to end.
//
// It used to be reachable through a `__specimenUncontainedContinuity` option on replayMerged. That
// was a callable bypass on the PRODUCTION options surface: C4 established that the tested live path
// avoided it, which is not the same as ordinary callers being unable to select it.
//
// STATED LIMIT, unchanged by the move: in JavaScript a bypass that exists is callable by anyone who
// imports it. This reduces accidental selection; it does not make selection impossible.
import { contentOf } from './merge.mjs';

export function resolveContinuityUNCONTAINED(merged, continuity) {
  const findings = [];
  for (const [predecessor, auth] of Object.entries(continuity || {})) {
    const claimants = merged.records.filter((r) => r.entry.continuity
      && r.entry.continuity.predecessor === predecessor);
    const qualified = claimants.filter((r) => r.origin === auth.successorOrigin
      && contentOf(r.entry) === auth.successorContent);
    if (qualified.length > 1) {
      findings.push({ predecessor, ok: false, kind: 'FORK',
        claimants: qualified.map((r) => ({ origin: r.origin, ref: r.ref, occurrence: r.occurrence })),
        // Sorted, because L5 found the DECISION order-invariant while the MESSAGE was not: the
        // claimants were listed in record order, so the same refusal read differently under a
        // permutation. A refusal that changes with input order is not a refusal anyone can compare.
        why: 'more than one record satisfies this continuity authorization ('
          + qualified.map((r) => r.origin + '/' + r.ref).sort().join(', ') + '). NEITHER inherits:'
          + ' an ambiguous authorization is not resolved by insertion order' });
      continue;
    }
    if (qualified.length === 0) {
      findings.push({ predecessor, ok: false, kind: claimants.length ? 'UNAUTHORIZED' : 'ABSENT',
        claimants: claimants.map((r) => ({ origin: r.origin, ref: r.ref })),
        why: claimants.length
          ? 'record(s) assert continuity from this predecessor but none matches the authorized'
            + ' successor (origin ' + auth.successorOrigin + ', content '
            + String(auth.successorContent).slice(0, 12) + '...). Identifying a predecessor is not'
            + ' being authorized to continue it'
          : 'no record asserts continuity from this predecessor' });
      continue;
    }
    const r = qualified[0];
    findings.push({ predecessor, ok: true, kind: 'CONTINUED',
      successor: { origin: r.origin, ref: r.ref, occurrence: r.occurrence },
      transferGovernance: auth.transferGovernance === true,
      why: auth.transferGovernance === true
        ? 'continuity authorized AND the predecessor obligations transfer to this successor'
        : 'continuity authorized; governance does NOT transfer. Continuing a history and'
          + ' inheriting its obligations are different permissions' });
  }
  return findings;
}
