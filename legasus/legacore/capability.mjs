// LEGACORE — THE CAPABILITY CONTRACT. What Legasus can actually do, in a form Legasus can read.
//
// Run 0 exposed the gap: I hand-declared which tasks were inside the envelope and was partly wrong. A
// declaration is a guess about the machinery; the machinery should answer for itself. So the envelope is
// now COMPUTED, and the four questions are asked BEFORE any inference is bought:
//
//     CAN IT REPRESENT the requested operation?   is there a contract shape for this at all
//     CAN IT GENERATE it?                         is there a rendering that asks for exactly this
//     CAN IT CONSTRAIN it?                        is there a structural predicate set bounding it
//     CAN IT INDEPENDENTLY VERIFY it?             is there truth to check against that is not the proposal
//
// If ANY answer is UNKNOWN, the system refuses before spending a token. Refusing cheaply is the whole
// point: an architecture that discovers it cannot verify something only after generating it has already
// paid for the thing it cannot use.
//
// The four answers are kept SEPARATE because they fail for different reasons and are widened by different
// work. "Cannot verify" is a PROVE problem; "cannot constrain" is a LegaGate problem; collapsing them
// into one refusal loses the only information that says what to build next.
const NL = String.fromCharCode(10);

export const ANSWER = { YES: 'YES', NO: 'NO', UNKNOWN: 'UNKNOWN' };

// The operation classes this architecture currently owns. Adding a class here is a deliberate act with
// obligations attached, not a side effect of some code happening to work.
export const OPERATION = {
  GUARD_INSERTION: 'GUARD_INSERTION',
  BOUNDED_FUNCTION_BODY_EDIT: 'BOUNDED_FUNCTION_BODY_EDIT',
  PRESERVATION_CHECK: 'PRESERVATION_CHECK',
  FUNCTION_ADDITION: 'FUNCTION_ADDITION',
  MULTI_FILE_CHANGE: 'MULTI_FILE_CHANGE',
  CROSS_CUTTING_PROPERTY: 'CROSS_CUTTING_PROPERTY',
  UNDETERMINED_REQUEST: 'UNDETERMINED_REQUEST',
};

export const SUPPORTED = {
  [OPERATION.GUARD_INSERTION]: {
    represent: ANSWER.YES, generate: ANSWER.YES, constrain: ANSWER.YES, verify: ANSWER.YES,
    why: 'the original box: a guarded return over a domain, with contract-derived probes',
  },
  [OPERATION.BOUNDED_FUNCTION_BODY_EDIT]: {
    represent: ANSWER.YES, generate: ANSWER.YES, constrain: ANSWER.YES, verify: ANSWER.YES,
    why: 'rewrite the body of ONE structurally identified function, signature and siblings untouched,'
      + ' verified against an executable behavioural contract for that unit',
  },
  [OPERATION.PRESERVATION_CHECK]: {
    represent: ANSWER.YES, generate: ANSWER.YES, constrain: ANSWER.YES, verify: ANSWER.YES,
    why: 'confirm a behaviour already holds and change nothing; verified by the same probes',
  },
  [OPERATION.FUNCTION_ADDITION]: {
    represent: ANSWER.YES, generate: ANSWER.YES, constrain: ANSWER.YES, verify: ANSWER.UNKNOWN,
    why: 'a new behaviour has no prior truth to check against; an independently authored contract is'
      + ' required and the pipeline has no way to obtain one yet',
  },
  [OPERATION.MULTI_FILE_CHANGE]: {
    represent: ANSWER.UNKNOWN, generate: ANSWER.UNKNOWN, constrain: ANSWER.NO, verify: ANSWER.UNKNOWN,
    why: 'the writable surface and the atomicity contract are declared per unit, not across modules',
  },
  [OPERATION.CROSS_CUTTING_PROPERTY]: {
    represent: ANSWER.NO, generate: ANSWER.NO, constrain: ANSWER.NO, verify: ANSWER.NO,
    why: 'properties like thread-safety are not expressible as a behavioural contract over one unit',
  },
  [OPERATION.UNDETERMINED_REQUEST]: {
    represent: ANSWER.NO, generate: ANSWER.NO, constrain: ANSWER.NO, verify: ANSWER.NO,
    why: 'the request does not determine an obligation; deriving one would be inventing the spec',
  },
};

export const REFUSAL = {
  CANNOT_REPRESENT: 'CANNOT_REPRESENT',
  CANNOT_GENERATE: 'CANNOT_GENERATE',
  CANNOT_CONSTRAIN: 'CANNOT_CONSTRAIN',
  CANNOT_VERIFY: 'CANNOT_VERIFY',
  NONAUTHORITATIVE_SOURCE: 'NONAUTHORITATIVE_SOURCE',
  UNKNOWN_RUNTIME_PROVENANCE: 'UNKNOWN_RUNTIME_PROVENANCE',
};

// Ask all four questions. `runtimeAuthoritative` is supplied by OBSERVE and is deliberately a separate
// input: a perfectly representable operation on source that nothing executes is still a refusal, and it
// is a DIFFERENT refusal, because the fix is different.
export function assess({ operation, runtimeAuthoritative = null, hasExecutableContract = null }) {
  const cap = SUPPORTED[operation];
  if (!cap) {
    return { admit: false, refusal: REFUSAL.CANNOT_REPRESENT, operation,
      why: 'no capability is declared for ' + operation };
  }

  if (runtimeAuthoritative === false) {
    return { admit: false, refusal: REFUSAL.NONAUTHORITATIVE_SOURCE, operation, capability: cap,
      why: 'the edit surface is shadowed at runtime, so editing it cannot change the behaviour' };
  }
  if (runtimeAuthoritative === null && operation !== OPERATION.CROSS_CUTTING_PROPERTY
    && operation !== OPERATION.UNDETERMINED_REQUEST) {
    return { admit: false, refusal: REFUSAL.UNKNOWN_RUNTIME_PROVENANCE, operation, capability: cap,
      why: 'OBSERVE has not established that the intended source participates in the behaviour' };
  }

  const order = [['represent', REFUSAL.CANNOT_REPRESENT], ['generate', REFUSAL.CANNOT_GENERATE],
    ['constrain', REFUSAL.CANNOT_CONSTRAIN], ['verify', REFUSAL.CANNOT_VERIFY]];
  for (const [q, refusal] of order) {
    if (cap[q] !== ANSWER.YES) {
      return { admit: false, refusal, operation, capability: cap, answer: cap[q],
        why: 'cannot ' + q + ' this operation: ' + cap.why };
    }
  }

  // A verifiable operation class still needs an actual contract for THIS instance.
  if (hasExecutableContract === false) {
    return { admit: false, refusal: REFUSAL.CANNOT_VERIFY, operation, capability: cap,
      why: 'the class is verifiable but this instance has no executable contract to check against' };
  }

  return { admit: true, operation, capability: cap, why: 'representable, generable, constrainable and'
    + ' independently verifiable' };
}

// The envelope of an OPERATION CLASS, derived from the same answers the pipeline uses rather than
// predicted by hand. This is a statement about the class, and it is deliberately NOT the whole story.
export function envelopeOf(operation) {
  const cap = SUPPORTED[operation];
  if (!cap) return 'OUT';
  const answers = [cap.represent, cap.generate, cap.constrain, cap.verify];
  if (answers.every((a) => a === ANSWER.YES)) return 'IN';
  if (answers.some((a) => a === ANSWER.NO)) return 'OUT';
  return 'BOUNDARY';
}

// THE ENVELOPE OF AN INSTANCE, which is what actually decides whether work may proceed.
//
// The class envelope alone is not enough, and an audit of the Run 0 tasks proved it: the `_bisect` task is
// a perfectly ordinary bounded body edit AS A CLASS, so the class envelope said IN - while `assess()`
// correctly refuses it, because the source it would edit is shadowed at runtime. Runtime authority is a
// property of THIS instance, not of the operation kind.
//
// Reporting a class envelope as if it were an instance envelope is how a capability contract starts lying
// about what it can do.
export function envelopeOfInstance({ operation, runtimeAuthoritative = null,
  hasExecutableContract = null }) {
  const verdict = assess({ operation, runtimeAuthoritative, hasExecutableContract });
  if (verdict.admit) return { envelope: 'IN', why: verdict.why };
  if (verdict.refusal === REFUSAL.NONAUTHORITATIVE_SOURCE
    || verdict.refusal === REFUSAL.UNKNOWN_RUNTIME_PROVENANCE) {
    return { envelope: 'OUT', why: verdict.why, refusal: verdict.refusal,
      note: 'the operation CLASS is ' + envelopeOf(operation) + '; this INSTANCE is not admissible' };
  }
  return { envelope: envelopeOf(operation), why: verdict.why, refusal: verdict.refusal };
}

export { NL };
