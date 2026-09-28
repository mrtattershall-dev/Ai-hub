// H-DEFAULT — THE FROZEN ROLE TABLE.
//
//     An omitted coordinate has no meaning until you know what role the object is playing.
//
// `{}` as a QUERY means "I am not asking about it". As a DELTA it means "do not change it". As
// EVIDENCE it means "nothing was observed about it". As a STATE it means the description is
// incomplete. Those are four different semantic objects, and `ANY` is a fifth thing entirely - an
// explicit value, not an absence.
//
// THE TABLE IS FROZEN AND GROWING IT IS THE FAILURE CONDITION OF THE EXPERIMENT. If a historical
// defect needs a seventh role or a new completion law, H-DEFAULT is an explanation machine rather
// than a theory, and `classify` throws rather than letting it in quietly. That throw is the control.
export const ROLE = {
  STATE: 'STATE',         // a complete description of what is
  DELTA: 'DELTA',         // a description of what changes
  QUERY: 'QUERY',         // a description of what matters for this question
  EVIDENCE: 'EVIDENCE',   // a description of what was established
  GRANT: 'GRANT',         // a description of what is authorized
  REQUEST: 'REQUEST',     // a description of authority being requested
};

// The completion law for an OMITTED coordinate, per role. One entry each, no exceptions.
export const COMPLETION = {
  [ROLE.STATE]: 'UNKNOWN',
  [ROLE.DELTA]: 'PRESERVE',
  [ROLE.QUERY]: 'DONT_CARE',
  [ROLE.EVIDENCE]: 'NOT_ESTABLISHED',
  [ROLE.GRANT]: 'EXPLICIT_REQUIRED',
  [ROLE.REQUEST]: 'INHERIT',
};

// VALUES ARE NOT OMISSIONS. A coordinate that says ANY is present and explicit; one that is absent
// is not. Collapsing the two is a different defect from completing an omission wrongly, and the
// experiment reports them separately rather than counting one as the other.
export const VALUE = { EXACT: 'EXACT', ANY: 'ANY', ABSENT: 'ABSENT', UNKNOWN: 'UNKNOWN',
  UNADMITTED: 'UNADMITTED', OPAQUE: 'OPAQUE', STALE: 'STALE' };

export const LAWS = new Set(Object.values(COMPLETION));

export const VERDICT = {
  EXPLAINED: 'EXPLAINED',               // an omission completed under the wrong role's law
  VALUE_CONFUSION: 'VALUE_CONFUSION',   // an explicit VALUE mishandled - the table does not cover it
  NOT_AN_OMISSION: 'NOT_AN_OMISSION',   // a defect of another kind entirely
};

// The guard. An entry naming a role or a law outside the frozen table is REFUSED, which is what
// makes "the taxonomy did not grow" a measurement rather than a promise.
export function classify(entry) {
  const { id, role, applied, verdict } = entry;
  if (!Object.values(VERDICT).includes(verdict)) throw new Error(id + ': unknown verdict ' + verdict);
  if (verdict !== VERDICT.EXPLAINED) {
    if (role || applied) throw new Error(id + ': only an EXPLAINED entry carries a role and a law');
    return { ...entry, required: null, confusion: null };
  }
  if (!Object.values(ROLE).includes(role)) {
    throw new Error(id + ': ' + role + ' IS NOT ONE OF THE SIX FROZEN ROLES. Adding one here is the'
      + ' failure condition of H-DEFAULT, not a refinement of it.');
  }
  if (!LAWS.has(applied)) {
    throw new Error(id + ': ' + applied + ' IS NOT ONE OF THE SIX FROZEN COMPLETION LAWS.');
  }
  const required = COMPLETION[role];
  if (applied === required) throw new Error(id + ': marked EXPLAINED but the applied law is correct');
  // Which role's law was applied instead. Reported so "several different confusions" is checkable
  // rather than asserted.
  const asRole = Object.keys(COMPLETION).find((r) => COMPLETION[r] === applied);
  return { ...entry, required, confusion: role + ' read as ' + asRole };
}
