// GATE 12C — PRECEDENCE.
//
// When two behaviours overlap, which one owns the shared input? This is the first component permitted
// to read intent, and the only one that may diverge on the must-distinguish pair: 12A gives both cases
// identical domains, 12B gives both cases identical overlap, and everything that differs must enter
// here or the architecture has not isolated semantic intent at all.
//
// EVIDENCE AUTHORITIES, from LEGASUS_V7.md and enforced by construction - this module is handed only
// the permitted evidence and never receives the rest:
//
//   MAY ANSWER    the requested delta, the preservation contract, verified existing behaviour,
//                 and domain relations the task states ("except", "unless", "for all other ...")
//   MAY NOT       the reference patch, site, order or branch shape; canonical realization;
//                 current source order BY ITSELF
//
// SOURCE ORDER IS NOT EVIDENCE. In the canonical example the existing `n == 0` guard happens to sit
// above where a new guard would go, and that fact is available and useless: case B wants the NEW
// behaviour to win over the very same program. If precedence could be read off source order, the two
// cases would be indistinguishable, which is precisely the failure this gate exists to avoid.
//
// THREE OUTCOMES, and abstention is not free:
//
//   PRECEDENCE(A > B)      the contract settles the overlap
//   NO_PRECEDENCE_NEEDED   the domains cannot both apply
//   AMBIGUOUS_INTENT       they overlap and the contract does not say which wins
const NL = String.fromCharCode(10);

// ---- the two directions a specification can state, as PREDICATES over the preservation contract and
// the delta text. These are linguistic forms, not subject matter: nothing here mentions zero, small,
// or any domain.
//
// PRESERVE: the existing behaviour is explicitly protected.
const PRESERVE_FORMS = [
  /\bpreserve\b/i,
  /\bkeep(s|ing)?\b[^.]*\b(working|unchanged|as (it|they) (is|are|do|does))\b/i,
  /\bmust (still|continue to)\b/i,
  /\bexisting\b[^.]*\bhandling\b/i,
  /\bunchanged\b/i,
  /\bstill\b[^.]*\breturn/i,
];
// OVERRIDE: the new behaviour explicitly claims inputs the old one had.
const OVERRIDE_FORMS = [
  /\bincluding\b[^.]*\bpreviously\b/i,
  /\beven\b[^.]*\bpreviously\b/i,
  /\binstead of\b/i,
  /\boverrid(e|es|ing)\b/i,
  /\bnow\b[^.]*\breturn[^.]*\binstead\b/i,
  /\breplaces?\b[^.]*\bexisting\b/i,
  /\btakes? precedence\b/i,
];
// EXCEPTION: the new behaviour explicitly excludes what the old one covers, which is a statement that
// the old behaviour keeps its inputs.
const EXCEPTION_FORMS = [
  /\bexcept\b/i,
  /\bunless\b/i,
  /\bother than\b/i,
  /\bfor (all )?other\b/i,
  /\bapart from\b/i,
];

const anyMatch = (forms, text) => forms.find((re) => re.test(text || ''));

// `evidence` carries ONLY what may answer precedence.
//   preservation_text  the clause protecting existing behaviour, or null
//   delta_text         the clause requesting the new behaviour
//   existing           { condition, result }  verified from the program
//   requested          { condition, result }  extracted from the delta
export function derivePrecedence(evidence, overlapResult) {
  const { preservation_text, delta_text, existing, requested } = evidence || {};

  if (!overlapResult || overlapResult.result === 'UNKNOWN') {
    return { outcome: 'AMBIGUOUS_INTENT',
      reason: 'overlap could not be decided, so precedence is not answerable either. Declining here '
        + 'rather than guessing keeps an undecidable overlap from becoming a confident ordering.',
      evidence_used: [] };
  }
  if (overlapResult.result === 'DISJOINT') {
    return { outcome: 'NO_PRECEDENCE_NEEDED',
      reason: 'the domains cannot both apply to any input, so no input is contested: '
        + overlapResult.reason,
      evidence_used: ['overlap'] };
  }

  const used = [];
  const preserve = preservation_text ? anyMatch(PRESERVE_FORMS, preservation_text) : null;
  const exception = anyMatch(EXCEPTION_FORMS, delta_text);
  const override = anyMatch(OVERRIDE_FORMS, delta_text)
    || (preservation_text ? anyMatch(OVERRIDE_FORMS, preservation_text) : null);

  // An explicit override claim is the strongest statement either way: it names the inputs the existing
  // behaviour had and says the new behaviour takes them.
  if (override) {
    used.push('requested_delta:override');
    return { outcome: 'PRECEDENCE', winner: 'requested', loser: 'existing',
      statement: 'requested behaviour > existing behaviour',
      reason: 'the specification states that the new behaviour claims inputs the existing behaviour '
        + 'previously handled (matched: ' + String(override) + ')',
      evidence_used: used, witness_input: overlapResult.witness };
  }

  // Preservation, or an exception carved out of the new domain, both say the existing behaviour keeps
  // the contested input. They are different sentences making the same claim.
  if (preserve || exception) {
    if (preserve) used.push('preservation_contract');
    if (exception) used.push('domain_relation:exception');
    return { outcome: 'PRECEDENCE', winner: 'existing', loser: 'requested',
      statement: 'existing behaviour > requested behaviour',
      reason: (preserve
        ? 'the specification explicitly preserves the existing behaviour (matched: ' + String(preserve) + ')'
        : '') + (preserve && exception ? '; ' : '')
        + (exception
          ? 'the requested behaviour is stated as applying to the OTHER inputs (matched: '
            + String(exception) + ')' : ''),
      evidence_used: used, witness_input: overlapResult.witness };
  }

  return { outcome: 'AMBIGUOUS_INTENT',
    reason: 'the behaviours overlap at input ' + overlapResult.witness + ', and the specification '
      + 'neither protects the existing behaviour nor states that the new one replaces it. Source order '
      + 'is NOT used to break this tie - it would answer both directions of the must-distinguish pair '
      + 'the same way.',
    evidence_used: [], witness_input: overlapResult.witness };
}

export { NL, PRESERVE_FORMS, OVERRIDE_FORMS, EXCEPTION_FORMS };
